// WebSocket transport (§5.2): hello on open, backoff reconnect, op queue while closed, sync.request
// after a reconnect, cursor throttle + keepalive. Every inbound frame is validated by parseWire.
import type { Identity, Op, Point, Presence, RoomState, SyncStatus } from "../map/types";
import { createEmitter } from "./emitter";
import { parseWire } from "./schema";
import type { EphemeralMessage, Transport, TransportOptions, WireMessage } from "./transport";

type ErrorFrame = Extract<WireMessage, { k: "error" }>;

export const WS_QUEUE_CAP = 1000;
export const WS_BACKOFF_BASE_MS = 500;
export const WS_BACKOFF_MAX_MS = 15_000;
export const WS_OFFLINE_AFTER = 10;
export const WS_OFFLINE_RETRY_MS = 15_000;
export const CURSOR_THROTTLE_MS = 50;
export const CURSOR_KEEPALIVE_MS = 20_000;

/** min(15000, 500 * 2^n) ± 20 % jitter (random in [0, 1)). */
export function backoffDelay(failures: number, random: () => number = Math.random): number {
  const base = Math.min(WS_BACKOFF_MAX_MS, WS_BACKOFF_BASE_MS * 2 ** Math.max(0, failures));
  const jitter = (random() * 2 - 1) * 0.2;
  return Math.round(base * (1 + jitter));
}

export function relayWsUrl(relayUrl: string, room: string): string {
  return `${relayUrl.replace(/\/$/, "")}/ws?room=${encodeURIComponent(room)}`;
}

export interface WsTransport extends Transport {
  /** Ops waiting for the socket. */
  readonly pending: number;
  /** Consecutive failed connections. */
  readonly failures: number;
}

export function createWsTransport(opts: TransportOptions & { relayUrl: string }): WsTransport {
  const onOp = createEmitter<Op>();
  const onSnapshot = createEmitter<RoomState>();
  const onOps = createEmitter<Op[]>();
  const onPresence = createEmitter<Presence[]>();
  const onEphemeral = createEmitter<EphemeralMessage>();
  const onStatus = createEmitter<SyncStatus>();
  const onError = createEmitter<ErrorFrame>();

  let status: SyncStatus = "connecting";
  let ws: WebSocket | null = null;
  let room = "";
  let identity: Identity | null = null;
  let firstSnapshot: RoomState | null = null;
  let firstSeq = 0;
  let everOpened = false;
  let closed = true;
  let failures = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let cursorTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingCursor: Point | null | undefined;
  let lastSent = 0;
  const queue: Op[] = [];

  const setStatus = (s: SyncStatus) => {
    if (status === s) return;
    status = s;
    onStatus.emit(s);
  };

  const isOpen = () => ws !== null && ws.readyState === WebSocket.OPEN;

  const raw = (msg: WireMessage) => {
    if (!isOpen()) return false;
    try {
      ws!.send(JSON.stringify(msg));
      lastSent = Date.now();
      return true;
    } catch {
      return false;
    }
  };

  const currentSeq = () => opts.getState()?.seq ?? firstSeq;

  const flush = () => {
    while (queue.length && isOpen()) raw({ k: "op", room, op: queue.shift()! });
  };

  const clearTimers = () => {
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (keepaliveTimer !== null) clearInterval(keepaliveTimer);
    keepaliveTimer = null;
    if (cursorTimer !== null) clearTimeout(cursorTimer);
    cursorTimer = null;
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== null) return;
    const delay = failures >= WS_OFFLINE_AFTER ? WS_OFFLINE_RETRY_MS : backoffDelay(failures);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const handleMessage = (data: unknown) => {
    const text =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? new TextDecoder().decode(data)
          : String(data);
    const msg = parseWire(text, text.length);
    if (!msg || msg.room !== room) return;
    switch (msg.k) {
      case "op":
        onOp.emit(msg.op);
        break;
      case "sync.snapshot":
        onSnapshot.emit(msg.state);
        break;
      case "sync.ops":
        onOps.emit(msg.ops);
        break;
      case "presence":
        onPresence.emit(msg.members);
        break;
      case "hello":
        if (msg.snapshot) onSnapshot.emit(msg.snapshot);
        break;
      case "ping":
      case "cursor":
      case "map.request":
      case "map.chunk":
        onEphemeral.emit(msg);
        break;
      case "error":
        onError.emit(msg);
        if (msg.code === "kicked" || msg.code === "room-full") {
          // The relay closes the socket next; do not fight it.
          closed = true;
        }
        break;
      case "sync.request":
      case "bye":
        break;
    }
  };

  const connect = () => {
    if (closed || !identity) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(relayWsUrl(opts.relayUrl, room));
    } catch {
      failures++;
      setStatus(failures >= WS_OFFLINE_AFTER ? "offline" : "reconnecting");
      scheduleReconnect();
      return;
    }
    ws = socket;
    let openedHere = false;
    socket.onopen = () => {
      if (socket !== ws) return;
      openedHere = true;
      const reconnect = everOpened;
      everOpened = true;
      failures = 0;
      const snapshot = reconnect ? opts.getState() : (firstSnapshot ?? opts.getState());
      raw({ k: "hello", room, identity: identity!, seq: currentSeq(), snapshot });
      if (reconnect) raw({ k: "sync.request", room, since: currentSeq() });
      flush();
      setStatus("live");
      if (keepaliveTimer !== null) clearInterval(keepaliveTimer);
      keepaliveTimer = setInterval(() => {
        if (Date.now() - lastSent >= CURSOR_KEEPALIVE_MS - 50 && identity)
          raw({ k: "cursor", room, client: identity.client, at: null });
      }, CURSOR_KEEPALIVE_MS);
    };
    socket.onmessage = (e) => {
      if (socket === ws) handleMessage(e.data);
    };
    socket.onerror = () => {
      /* onclose follows */
    };
    socket.onclose = () => {
      if (socket !== ws) return;
      ws = null;
      if (keepaliveTimer !== null) clearInterval(keepaliveTimer);
      keepaliveTimer = null;
      if (closed) return;
      if (!openedHere) failures++;
      setStatus(failures >= WS_OFFLINE_AFTER ? "offline" : "reconnecting");
      scheduleReconnect();
    };
  };

  const sendCursor = () => {
    cursorTimer = null;
    if (pendingCursor === undefined || !identity) return;
    const at = pendingCursor;
    pendingCursor = undefined;
    raw({ k: "cursor", room, client: identity.client, at });
  };

  const transport: WsTransport = {
    kind: "ws",
    get status() {
      return status;
    },
    get pending() {
      return queue.length;
    },
    get failures() {
      return failures;
    },
    async join(roomCode, id, seq, snapshot) {
      if (!closed) transport.leave();
      room = roomCode;
      identity = id;
      firstSnapshot = snapshot;
      firstSeq = seq;
      closed = false;
      everOpened = false;
      failures = 0;
      setStatus("connecting");
      connect();
    },
    send(op) {
      if (isOpen()) {
        raw({ k: "op", room, op });
        return;
      }
      if (queue.length >= WS_QUEUE_CAP) queue.shift();
      queue.push(op);
    },
    sendEphemeral(msg) {
      if (msg.k === "cursor") {
        pendingCursor = msg.at;
        if (cursorTimer !== null) return;
        const wait = Math.max(0, CURSOR_THROTTLE_MS - (Date.now() - lastSent));
        cursorTimer = setTimeout(sendCursor, wait);
        return;
      }
      raw({ ...msg, room });
    },
    requestSnapshot(since) {
      raw({ k: "sync.request", room, since });
    },
    onOp: (cb) => onOp.on(cb),
    onSnapshot: (cb) => onSnapshot.on(cb),
    onOps: (cb) => onOps.on(cb),
    onPresence: (cb) => onPresence.on(cb),
    onEphemeral: (cb) => onEphemeral.on(cb),
    onStatus: (cb) => onStatus.on(cb),
    onError: (cb) => onError.on(cb),
    leave() {
      if (closed && !ws) return;
      closed = true;
      clearTimers();
      if (identity && isOpen()) raw({ k: "bye", room, client: identity.client });
      const s = ws;
      ws = null;
      try {
        s?.close();
      } catch {
        /* already closed */
      }
    },
  };
  return transport;
}
