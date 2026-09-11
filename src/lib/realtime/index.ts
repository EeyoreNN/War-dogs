// Transport factory and relay URL resolution (§5.2).
import { loadRelayOverride } from "../storage/relay";
import type { Op, Presence, RoomState, SyncStatus } from "../map/types";
import { createBroadcastTransport } from "./broadcast";
import { activityRelayUrl, isInsideDiscord } from "./discord-env";
import { createEmitter } from "./emitter";
import type { EphemeralMessage, Transport, TransportOptions, WireMessage } from "./transport";
import { createWsTransport } from "./ws";

export type {
  Transport,
  TransportOptions,
  TransportKind,
  WireMessage,
  EphemeralMessage,
  MemoryBus,
  Unsubscribe,
} from "./transport";
export { createBroadcastTransport } from "./broadcast";
export { createWsTransport } from "./ws";
export { createMemoryBus, createMemoryTransport } from "./memory";
export { WIRE_LIMITS, parseWire, wireLimit, WireMessageSchema } from "./schema";
export { isInsideDiscord, activityRelayUrl } from "./discord-env";

export const DEFAULT_CONNECT_TIMEOUT_MS = 3_000;
export const RELAY_RETRY_MS = 30_000;

/**
 * 1) inside Discord with a relay configured → the Activity's /relay mapping; 2) the localStorage
 * override ("off" → LOCAL, any ws(s) URL); 3) NEXT_PUBLIC_RELAY_URL; 4) undefined → broadcast.
 * Never a query parameter.
 */
export function resolveRelayUrl(): string | undefined {
  const env = process.env.NEXT_PUBLIC_RELAY_URL?.trim() || undefined;
  if (isInsideDiscord() && env) return activityRelayUrl();
  const override = loadRelayOverride();
  if (override === "off") return undefined;
  if (override) return override;
  return env;
}

type ErrorFrame = Extract<WireMessage, { k: "error" }>;

export interface RelayTransport extends Transport {
  /** true when the relay never answered at boot and the room fell back to this browser only. */
  readonly fellBack: boolean;
}

/**
 * ws when relayUrl is set, else broadcast. When the relay does not open within connectTimeoutMs
 * the room continues over BroadcastChannel (status "local") and a background retry every 30 s
 * upgrades back to the relay (state merged through the hello snapshot).
 */
export function createTransport(opts: TransportOptions): Transport {
  if (!opts.relayUrl) return createBroadcastTransport(opts);
  return createRelayTransport({ ...opts, relayUrl: opts.relayUrl });
}

export function createRelayTransport(
  opts: TransportOptions & { relayUrl: string },
): RelayTransport {
  const timeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const onOp = createEmitter<Op>();
  const onSnapshot = createEmitter<RoomState>();
  const onOps = createEmitter<Op[]>();
  const onPresence = createEmitter<Presence[]>();
  const onEphemeral = createEmitter<EphemeralMessage>();
  const onStatus = createEmitter<SyncStatus>();
  const onError = createEmitter<ErrorFrame>();

  let inner: Transport | null = null;
  let unsub: (() => void)[] = [];
  let fellBack = false;
  let joinArgs: Parameters<Transport["join"]> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let left = true;

  const wire = (t: Transport) => {
    unsub.forEach((u) => u());
    unsub = [
      t.onOp((o) => onOp.emit(o)),
      t.onSnapshot((s) => onSnapshot.emit(s)),
      t.onOps((o) => onOps.emit(o)),
      t.onPresence((p) => onPresence.emit(p)),
      t.onEphemeral((m) => onEphemeral.emit(m)),
      t.onStatus((s) => {
        if (t === inner) onStatus.emit(s);
      }),
      t.onError((e) => onError.emit(e)),
    ];
  };

  const stopTimers = () => {
    if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    fallbackTimer = null;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const rejoinArgs = (): Parameters<Transport["join"]> => {
    const [room, identity, seq, snapshot] = joinArgs!;
    const state = opts.getState();
    return [room, identity, state?.seq ?? seq, state ?? snapshot];
  };

  const fallBack = () => {
    if (left) return;
    inner?.leave();
    fellBack = true;
    const bc = createBroadcastTransport(opts);
    inner = bc;
    wire(bc);
    void bc.join(...rejoinArgs());
    onStatus.emit("local");
    scheduleRetry();
  };

  const scheduleRetry = () => {
    if (left || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      tryUpgrade();
    }, RELAY_RETRY_MS);
  };

  const tryUpgrade = () => {
    if (left) return;
    const probe = createWsTransport(opts);
    let done = false;
    const stop = probe.onStatus((s) => {
      if (done) return;
      if (s === "live") {
        done = true;
        stop();
        if (fallbackTimer !== null) clearTimeout(fallbackTimer);
        fallbackTimer = null;
        inner?.leave();
        inner = probe;
        fellBack = false;
        wire(probe);
        onStatus.emit("live");
      }
    });
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      if (done) return;
      done = true;
      stop();
      probe.leave();
      scheduleRetry();
    }, timeoutMs);
    void probe.join(...rejoinArgs());
  };

  const transport: RelayTransport = {
    kind: "ws",
    get status() {
      return inner ? inner.status : "connecting";
    },
    get fellBack() {
      return fellBack;
    },
    async join(room, identity, seq, snapshot) {
      transport.leave();
      left = false;
      joinArgs = [room, identity, seq, snapshot];
      const ws = createWsTransport(opts);
      inner = ws;
      wire(ws);
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null;
        if (ws.status !== "live") fallBack();
      }, timeoutMs);
      await ws.join(room, identity, seq, snapshot);
    },
    send: (op) => inner?.send(op),
    sendEphemeral: (m) => inner?.sendEphemeral(m),
    requestSnapshot: (since) => inner?.requestSnapshot(since),
    onOp: (cb) => onOp.on(cb),
    onSnapshot: (cb) => onSnapshot.on(cb),
    onOps: (cb) => onOps.on(cb),
    onPresence: (cb) => onPresence.on(cb),
    onEphemeral: (cb) => onEphemeral.on(cb),
    onStatus: (cb) => onStatus.on(cb),
    onError: (cb) => onError.on(cb),
    leave() {
      if (left) return;
      left = true;
      stopTimers();
      unsub.forEach((u) => u());
      unsub = [];
      inner?.leave();
      inner = null;
    },
  };
  return transport;
}
