// The peer-to-peer transport core shared by BroadcastChannel and the in-memory bus (§5.2): hello
// with the local snapshot, a sync.request after `syncRequestMs` with no snapshot, jittered
// snapshot replies from every holder (cancelled when another reply is seen), presence every 10 s,
// bye on leave. Status is always "local".
import type { Identity, Op, Point, Presence, RoomState, SyncStatus } from "../map/types";
import { createEmitter } from "./emitter";
import { validateWire } from "./schema";
import type {
  EphemeralMessage,
  Transport,
  TransportKind,
  TransportOptions,
  Unsubscribe,
  WireMessage,
} from "./transport";

export interface Channel {
  post(msg: WireMessage): void;
  onMessage(cb: (msg: unknown) => void): Unsubscribe;
  close(): void;
}

export interface PeerTiming {
  /** Post sync.request this long after hello when no snapshot has arrived (0 = synchronously). */
  syncRequestMs: number;
  /** Upper bound of the random delay before answering a sync.request / hello with a snapshot. */
  replyJitterMs: number;
  presenceMs: number;
}

export const BROADCAST_TIMING: PeerTiming = {
  syncRequestMs: 300,
  replyJitterMs: 300,
  presenceMs: 10_000,
};
export const MEMORY_TIMING: PeerTiming = { syncRequestMs: 0, replyJitterMs: 0, presenceMs: 10_000 };

export const SEND_QUEUE_CAP = 1000;
/** Same cadence as the ws transport: at most one cursor frame per 50 ms, trailing edge. */
const CURSOR_THROTTLE_MS = 50;

type ErrorFrame = Extract<WireMessage, { k: "error" }>;

export function createPeerTransport(
  kind: TransportKind,
  openChannel: (room: string) => Channel,
  opts: TransportOptions,
  timing: PeerTiming,
  now: () => number = () => Date.now(),
): Transport {
  const onOp = createEmitter<Op>();
  const onSnapshot = createEmitter<RoomState>();
  const onOps = createEmitter<Op[]>();
  const onPresence = createEmitter<Presence[]>();
  const onEphemeral = createEmitter<EphemeralMessage>();
  const onStatus = createEmitter<SyncStatus>();
  const onError = createEmitter<ErrorFrame>();

  let channel: Channel | null = null;
  let room = "";
  let identity: Identity | null = null;
  let joined = false;
  let gotSnapshot = false;
  const queue: Op[] = [];
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let replyTimer: ReturnType<typeof setTimeout> | null = null;
  let presenceTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeChannel: Unsubscribe | null = null;
  let pendingCursor: Point | null | undefined;
  let cursorTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCursorAt = 0;

  const post = (msg: WireMessage) => {
    if (!channel) return;
    try {
      channel.post(msg);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.warn("[wardogs] post failed", e);
    }
  };

  const schedule = (ms: number, fn: () => void): ReturnType<typeof setTimeout> | null => {
    if (ms <= 0) {
      fn();
      return null;
    }
    return setTimeout(fn, ms);
  };

  const cancelReply = () => {
    if (replyTimer !== null) {
      clearTimeout(replyTimer);
      replyTimer = null;
    }
  };

  /** Answer with a snapshot after a random delay unless someone else answers first. */
  const scheduleReply = () => {
    if (replyTimer !== null) return;
    const delay = timing.replyJitterMs > 0 ? Math.random() * timing.replyJitterMs : 0;
    const fire = () => {
      replyTimer = null;
      const state = opts.getState();
      if (state) post({ k: "sync.snapshot", room, state });
    };
    replyTimer = schedule(delay, fire);
  };

  const selfPresence = (): Presence[] =>
    identity
      ? [{ client: identity.client, callsign: identity.callsign, seenAt: now(), cursor: null }]
      : [];

  const handle = (raw: unknown) => {
    const msg = validateWire(raw);
    if (!msg || msg.room !== room) return;
    switch (msg.k) {
      case "hello":
        onPresence.emit([
          {
            client: msg.identity.client,
            callsign: msg.identity.callsign,
            seenAt: now(),
            cursor: null,
          },
        ]);
        if (msg.snapshot) {
          gotSnapshot = true;
          onSnapshot.emit(msg.snapshot);
        }
        // Tell the newcomer we are here right away rather than at the next 10 s presence beat.
        post({ k: "presence", room, members: selfPresence() });
        if (opts.getState()) scheduleReply();
        break;
      case "op":
        onOp.emit(msg.op);
        break;
      case "sync.request":
        if (opts.getState()) scheduleReply();
        break;
      case "sync.snapshot":
        gotSnapshot = true;
        cancelReply();
        if (syncTimer !== null) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        onSnapshot.emit(msg.state);
        break;
      case "sync.ops":
        onOps.emit(msg.ops);
        break;
      case "presence":
        onPresence.emit(msg.members);
        break;
      case "bye":
        break;
      case "ping":
      case "cursor":
      case "map.request":
      case "map.chunk":
        onEphemeral.emit(msg);
        break;
      case "error":
        onError.emit(msg);
        break;
    }
  };

  const flush = () => {
    while (queue.length) post({ k: "op", room, op: queue.shift()! });
  };

  const flushCursor = () => {
    cursorTimer = null;
    if (pendingCursor === undefined || !joined) return;
    const at = pendingCursor;
    pendingCursor = undefined;
    lastCursorAt = Date.now();
    post({ k: "cursor", room, client: identity!.client, at });
  };

  const transport: Transport = {
    kind,
    get status(): SyncStatus {
      return "local";
    },
    async join(roomCode, id, seq, snapshot) {
      transport.leave();
      room = roomCode;
      identity = id;
      gotSnapshot = false;
      channel = openChannel(roomCode);
      unsubscribeChannel = channel.onMessage(handle);
      joined = true;
      post({ k: "hello", room, identity: id, seq, snapshot });
      if (!gotSnapshot) {
        syncTimer = schedule(timing.syncRequestMs, () => {
          syncTimer = null;
          if (!gotSnapshot) post({ k: "sync.request", room, since: seq });
        });
      }
      presenceTimer = setInterval(
        () => post({ k: "presence", room, members: selfPresence() }),
        timing.presenceMs,
      );
      flush();
      onStatus.emit("local");
    },
    send(op) {
      if (!joined) {
        if (queue.length >= SEND_QUEUE_CAP) queue.shift();
        queue.push(op);
        return;
      }
      post({ k: "op", room, op });
    },
    sendEphemeral(msg) {
      if (!joined) return;
      if (msg.k === "cursor") {
        // Trailing-edge throttle, like the ws transport: the last position always goes out.
        pendingCursor = msg.at;
        if (cursorTimer !== null) return;
        const wait = Math.max(0, CURSOR_THROTTLE_MS - (Date.now() - lastCursorAt));
        cursorTimer = setTimeout(flushCursor, wait);
        return;
      }
      post({ ...msg, room });
    },
    requestSnapshot(since) {
      if (!joined) return;
      post({ k: "sync.request", room, since });
    },
    onOp: (cb) => onOp.on(cb),
    onSnapshot: (cb) => onSnapshot.on(cb),
    onOps: (cb) => onOps.on(cb),
    onPresence: (cb) => onPresence.on(cb),
    onEphemeral: (cb) => onEphemeral.on(cb),
    onStatus: (cb) => onStatus.on(cb),
    onError: (cb) => onError.on(cb),
    leave() {
      if (!joined) return;
      if (identity) post({ k: "bye", room, client: identity.client });
      joined = false;
      if (syncTimer !== null) clearTimeout(syncTimer);
      syncTimer = null;
      if (cursorTimer !== null) clearTimeout(cursorTimer);
      cursorTimer = null;
      pendingCursor = undefined;
      cancelReply();
      if (presenceTimer !== null) clearInterval(presenceTimer);
      presenceTimer = null;
      unsubscribeChannel?.();
      unsubscribeChannel = null;
      channel?.close();
      channel = null;
    },
  };
  return transport;
}
