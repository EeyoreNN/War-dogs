import { newId } from "@/lib/map/ids";
import { boundaryDate, resetBoundary } from "./engine";
import type { AdminCommand, TimedCommand } from "./types";

/**
 * Where visitor commands live and how tabs share them (§4.8, §5.4):
 * `localStorage wardogs:sim:<YYYY-MM-DD>` (UTC date of the 04:00Z boundary; older keys are
 * deleted on load) and `BroadcastChannel wardogs:sim`. Browser-only; no React.
 */

export const SIM_KEY_PREFIX = "wardogs:sim:";
export const SIM_CHANNEL = "wardogs:sim";

type Message = { type: "cmd"; cmd: TimedCommand } | { type: "sync"; cmds: TimedCommand[] };

export function simKey(nowMs: number): string {
  return `${SIM_KEY_PREFIX}${boundaryDate(nowMs)}`;
}

/** Ids for commands (§3.4 `newId`, 16 base32 chars from the crypto RNG). */
export const newCommandId = newId;

function isCommand(v: unknown): v is TimedCommand {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.at === "number" &&
    typeof c.actor === "string" &&
    typeof c.cmd === "object" &&
    c.cmd !== null &&
    typeof (c.cmd as { t?: unknown }).t === "string"
  );
}

function readKey(key: string): TimedCommand[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCommand) : [];
  } catch {
    return [];
  }
}

/** Load today's commands and drop every older `wardogs:sim:*` key. */
export function loadCommands(nowMs: number): TimedCommand[] {
  const key = simKey(nowMs);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SIM_KEY_PREFIX) && k !== key) localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable: memory only */
  }
  return readKey(key).filter((c) => c.at >= resetBoundary(nowMs));
}

export function saveCommands(nowMs: number, cmds: TimedCommand[]): boolean {
  try {
    localStorage.setItem(simKey(nowMs), JSON.stringify(cmds));
    return true;
  } catch {
    return false;
  }
}

export interface SimBridge {
  /** Current command log (sorted by time). */
  commands(): TimedCommand[];
  /** Append a command as `actor`, persist it, and tell the other tabs. Returns the timed command. */
  push(cmd: AdminCommand, actor: string, at?: number): TimedCommand;
  /** Re-read storage (a new day rolled over, or a `storage` event arrived). */
  reload(): void;
  subscribe(listener: () => void): () => void;
  close(): void;
  /** False after a failed write: memory only for this tab. */
  storageOk: boolean;
}

export function createSimBridge(now: () => number = Date.now): SimBridge {
  let cmds: TimedCommand[] = loadCommands(now());
  let day = boundaryDate(now());
  const listeners = new Set<() => void>();
  const ids = new Set(cmds.map((c) => c.id));
  let storageOk = true;

  const notify = () => listeners.forEach((l) => l());
  const sort = () => cmds.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));

  const channel: BroadcastChannel | null =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(SIM_CHANNEL);

  const absorb = (incoming: TimedCommand[]): boolean => {
    let changed = false;
    for (const c of incoming) {
      if (!isCommand(c) || ids.has(c.id) || c.at < resetBoundary(now())) continue;
      ids.add(c.id);
      cmds.push(c);
      changed = true;
    }
    if (changed) sort();
    return changed;
  };

  const onMessage = (e: MessageEvent<Message>) => {
    const m = e.data;
    if (!m || typeof m !== "object") return;
    const list = m.type === "cmd" ? [m.cmd] : m.type === "sync" ? m.cmds : [];
    if (absorb(list)) notify();
  };
  channel?.addEventListener("message", onMessage);

  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(SIM_KEY_PREFIX)) bridge.reload();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  const bridge: SimBridge = {
    get storageOk() {
      return storageOk;
    },
    commands: () => cmds,
    push(cmd, actor, at = now()) {
      const timed: TimedCommand = { id: newCommandId(), at, actor, cmd };
      const today = boundaryDate(at);
      if (today !== day) {
        // The 04:00Z boundary passed: yesterday's log is gone, start today's.
        day = today;
        cmds = [];
        ids.clear();
      }
      ids.add(timed.id);
      cmds.push(timed);
      sort();
      storageOk = saveCommands(at, cmds) && storageOk;
      try {
        channel?.postMessage({ type: "cmd", cmd: timed } satisfies Message);
      } catch {
        /* a closed channel */
      }
      notify();
      return timed;
    },
    reload() {
      const t = now();
      const today = boundaryDate(t);
      const fresh = loadCommands(t);
      if (today !== day) {
        day = today;
        cmds = [];
        ids.clear();
      }
      const before = cmds.length;
      absorb(fresh);
      if (cmds.length !== before || today !== day) notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      listeners.clear();
    },
  };
  return bridge;
}
