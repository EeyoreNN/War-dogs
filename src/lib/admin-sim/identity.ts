/**
 * A tiny adapter over `localStorage wardogs:identity` and `wardogs:prefs` (§5.4, WP1 owns the
 * real storage module). The dashboard needs the visitor's callsign — the same one used in war
 * rooms — and one preference (`showRcon`). It reads and writes the WP1 shapes exactly so both
 * modules agree; swap for `@/lib/storage` once merged.
 */

export const IDENTITY_KEY = "wardogs:identity";
export const PREFS_KEY = "wardogs:prefs";

export interface VisitorIdentity {
  v: 1;
  client: string;
  callsign: string;
  focus: string | null;
  ink: string;
}

const CALLSIGN_MAX = 24;

function hex(n: number): string {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(bytes);
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `Operator 41E3` — the generated callsign style shared with the demo (§4.2). */
export function generateCallsign(): string {
  return `Operator ${hex(2).toUpperCase()}`;
}

export function normaliseCallsign(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, CALLSIGN_MAX);
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return typeof v === "object" && v !== null ? (v as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Read the identity; create one (client id + generated callsign) on first use. */
export function loadVisitor(): VisitorIdentity {
  const found = read<Partial<VisitorIdentity>>(IDENTITY_KEY);
  if (
    found &&
    found.v === 1 &&
    typeof found.client === "string" &&
    typeof found.callsign === "string"
  ) {
    return {
      v: 1,
      client: found.client,
      callsign: normaliseCallsign(found.callsign) || generateCallsign(),
      focus: typeof found.focus === "string" ? found.focus : null,
      ink: typeof found.ink === "string" ? found.ink : "blue",
    };
  }
  const fresh: VisitorIdentity = {
    v: 1,
    client: hex(8),
    callsign: generateCallsign(),
    focus: null,
    ink: "blue",
  };
  write(IDENTITY_KEY, { ...(found ?? {}), ...fresh });
  return fresh;
}

/** Save a new callsign back to the identity, keeping every other field WP1 stores. */
export function saveCallsign(callsign: string): VisitorIdentity {
  const cur = loadVisitor();
  const next = {
    ...(read<Record<string, unknown>>(IDENTITY_KEY) ?? {}),
    ...cur,
    callsign: normaliseCallsign(callsign) || cur.callsign,
  };
  write(IDENTITY_KEY, next);
  return { v: 1, client: next.client, callsign: next.callsign, focus: next.focus, ink: next.ink };
}

/** `wardogs:prefs.showRcon` — open the "What this sends" sheet after every action (default true). */
export function loadShowRcon(): boolean {
  const p = read<{ showRcon?: unknown }>(PREFS_KEY);
  return p?.showRcon === undefined ? true : Boolean(p.showRcon);
}

export function saveShowRcon(value: boolean): void {
  const p = read<Record<string, unknown>>(PREFS_KEY) ?? { v: 1 };
  write(PREFS_KEY, { ...p, showRcon: value });
}
