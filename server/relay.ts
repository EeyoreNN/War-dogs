// The optional WebSocket relay (§3.6). Compiled by `tsc -p server/tsconfig.json` (CommonJS) and
// run under plain node; also started by `tsx` in dev and by Playwright. Relative imports only.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { newId } from "../src/lib/map/ids";
import { applyOp, canonicalOrder, mergeStates, nextSeq } from "../src/lib/map/reduce";
import {
  MAX_NODES_PER_OP,
  MAX_STATE_BYTES,
  asClientId,
  type ClientId,
  type Op,
  type Presence,
  type RoomState,
} from "../src/lib/map/types";
import { parseWire, WIRE_LIMITS } from "../src/lib/realtime/schema";
import type { WireMessage } from "../src/lib/realtime/transport";
import { RelayRoomSchema } from "../src/lib/room/schema";

export const RELAY_LIMITS = {
  socketsPerRoom: 64,
  rooms: 2_000,
  opsRing: 500,
  framesPerSecond: 60,
  rateStrikes: 3,
  badFrames: 20,
  helloTimeoutMs: 5_000,
  presenceIntervalMs: 15_000,
  idleSweepMs: 60_000,
  mapCacheBytes: 1_572_864,
} as const;

/** The relay's own actor id for the node.remove ops it emits when a room outgrows MAX_STATE_BYTES. */
export const RELAY_ACTOR: ClientId = asClientId("wd_RELAYRELAYRE");

export interface RelayOptions {
  allowedOrigins?: string[];
  maxRooms?: number;
  idleHours?: number;
  /** Test hook. */
  now?: () => number;
}

type MapChunk = Extract<WireMessage, { k: "map.chunk" }>;

interface Client {
  ws: WebSocket;
  room: Room;
  client: ClientId | null;
  callsign: string;
  seenAt: number;
  helloTimer: ReturnType<typeof setTimeout> | null;
  bad: number;
  strikes: number;
  tokens: number;
  tokensAt: number;
  left: boolean;
}

interface Room {
  name: string;
  state: RoomState | null;
  /** Ops applied since the last state merge, newest last (≤ opsRing). */
  ops: Op[];
  /** Seq of the state at the last merge that changed it; requests at or below it get a snapshot. */
  floor: number;
  /** Highest seq evicted from the ring since the last merge. */
  evictedMaxSeq: number;
  clients: Set<Client>;
  lastActive: number;
  map: { hash: string; chunks: Map<number, MapChunk>; n: number; bytes: number } | null;
}

export interface Relay {
  server: Server;
  wss: WebSocketServer;
  rooms: Map<string, Room>;
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

const CLOSE_BAD = 4002;
const CLOSE_RATE = 4029;
const CLOSE_KICKED = 4003;
const CLOSE_HELLO = 4008;
const CLOSE_FULL = 4013;

function parseOrigins(raw: string | undefined): string[] {
  if (raw === undefined) return process.env.NODE_ENV === "production" ? [] : ["*"];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function originAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (allowed.includes("*")) return true;
  if (!origin) return false;
  return allowed.includes(origin.replace(/\/$/, ""));
}

const stateChanged = (a: RoomState | null, b: RoomState): boolean =>
  a === null || JSON.stringify(a) !== JSON.stringify(b);

export function createRelay(opts: RelayOptions = {}): Relay {
  const allowed = opts.allowedOrigins ?? parseOrigins(process.env.RELAY_ALLOWED_ORIGINS);
  const maxRooms = opts.maxRooms ?? Number(process.env.RELAY_MAX_ROOMS ?? RELAY_LIMITS.rooms);
  const idleMs = (opts.idleHours ?? Number(process.env.RELAY_IDLE_HOURS ?? 6)) * 3_600_000;
  const now = opts.now ?? (() => Date.now());
  const rooms = new Map<string, Room>();

  const send = (c: Client, msg: WireMessage) => {
    if (c.ws.readyState !== c.ws.OPEN) return;
    try {
      c.ws.send(JSON.stringify(msg));
    } catch {
      /* the close handler cleans up */
    }
  };
  const fanOut = (room: Room, msg: WireMessage, except: Client | null) => {
    for (const c of room.clients) if (c !== except && c.client !== null) send(c, msg);
  };
  const fail = (
    c: Client,
    code: Extract<WireMessage, { k: "error" }>["code"],
    message: string,
    close: number | null,
  ) => {
    send(c, { k: "error", room: c.room.name, code, message });
    if (close !== null) c.ws.close(close, code);
  };

  const presenceOf = (room: Room): Presence[] => {
    const byClient = new Map<string, Presence>();
    for (const c of room.clients) {
      if (c.client === null || c.left) continue;
      const prev = byClient.get(c.client);
      if (!prev || c.seenAt > prev.seenAt)
        byClient.set(c.client, {
          client: c.client,
          callsign: c.callsign,
          seenAt: c.seenAt,
          cursor: null,
        });
    }
    return [...byClient.values()];
  };
  const broadcastPresence = (room: Room) => {
    const members = presenceOf(room);
    for (const c of room.clients)
      if (c.client !== null && !c.left) send(c, { k: "presence", room: room.name, members });
  };

  const ring = (room: Room, op: Op) => {
    room.ops.push(op);
    while (room.ops.length > RELAY_LIMITS.opsRing) {
      const dropped = room.ops.shift()!;
      room.evictedMaxSeq = Math.max(room.evictedMaxSeq, dropped.seq);
    }
  };
  const canServeOps = (room: Room, since: number) =>
    room.state !== null && since > room.floor && since > room.evictedMaxSeq;

  const setState = (room: Room, next: RoomState, merged: boolean) => {
    room.state = next;
    if (merged) {
      room.floor = next.seq;
      room.ops = [];
      room.evictedMaxSeq = 0;
    }
  };

  /** Keep the serialised state under MAX_STATE_BYTES by removing the oldest strokes (fanned out to all). */
  const enforceSize = (room: Room) => {
    let state = room.state;
    if (!state) return;
    let json = JSON.stringify(state);
    while (json.length > MAX_STATE_BYTES) {
      const strokes = canonicalOrder(state.nodes).filter((id) => state!.nodes[id].t === "stroke");
      if (strokes.length === 0) break;
      const ids = strokes.slice(
        0,
        Math.max(1, Math.min(MAX_NODES_PER_OP, Math.ceil(strokes.length * 0.1))),
      );
      const op: Op = {
        id: newId(),
        ts: now(),
        actor: RELAY_ACTOR,
        seq: nextSeq(state),
        t: "node.remove",
        ids,
      };
      state = applyOp(state, op);
      setState(room, state, false);
      ring(room, op);
      fanOut(room, { k: "op", room: room.name, op }, null);
      json = JSON.stringify(state);
    }
  };

  const applyRemote = (room: Room, op: Op): boolean => {
    if (room.state === null) return true;
    const next = applyOp(room.state, op);
    const changed = next.revs !== room.state.revs || next.tombstones !== room.state.tombstones;
    setState(room, next, false);
    return changed;
  };

  const kick = (room: Room, target: ClientId) => {
    for (const c of [...room.clients]) {
      if (c.client === target) {
        c.left = true;
        fail(c, "kicked", "You were removed from this room", CLOSE_KICKED);
      }
    }
  };

  const cacheChunk = (room: Room, chunk: MapChunk) => {
    if (!room.map || room.map.hash !== chunk.hash || room.map.n !== chunk.n) {
      room.map = { hash: chunk.hash, chunks: new Map(), n: chunk.n, bytes: 0 };
    }
    if (room.map.chunks.has(chunk.i)) return;
    const bytes = Math.floor((chunk.data.length * 3) / 4);
    if (room.map.bytes + bytes > RELAY_LIMITS.mapCacheBytes) {
      room.map = null;
      return;
    }
    room.map.chunks.set(chunk.i, chunk);
    room.map.bytes += bytes;
  };

  const handleHello = (c: Client, msg: Extract<WireMessage, { k: "hello" }>) => {
    const room = c.room;
    if (c.helloTimer !== null) clearTimeout(c.helloTimer);
    c.helloTimer = null;
    c.client = msg.identity.client;
    c.callsign = msg.identity.callsign;
    c.seenAt = now();
    if (msg.snapshot) {
      const merged = room.state ? mergeStates(room.state, msg.snapshot) : msg.snapshot;
      const changed = stateChanged(room.state, merged);
      if (changed) {
        // Ops that arrived before any state was known are replayed onto the first snapshot.
        const replay = room.state === null ? room.ops : [];
        let next = merged;
        for (const op of replay) next = applyOp(next, op);
        setState(room, next, true);
        enforceSize(room);
      }
    }
    if (room.state) {
      if (canServeOps(room, msg.seq) && msg.snapshot === null) {
        send(c, { k: "sync.ops", room: room.name, ops: room.ops.filter((o) => o.seq >= msg.seq) });
      } else {
        send(c, { k: "sync.snapshot", room: room.name, state: room.state });
      }
    }
    broadcastPresence(room);
  };

  const handleFrame = (c: Client, raw: string, byteLength: number) => {
    const room = c.room;
    const msg = parseWire(raw, byteLength);
    if (!msg || msg.room !== room.name || (c.client === null && msg.k !== "hello")) {
      c.bad++;
      if (c.bad >= RELAY_LIMITS.badFrames) fail(c, "bad-frame", "Too many bad frames", CLOSE_BAD);
      return;
    }
    room.lastActive = now();
    switch (msg.k) {
      case "hello":
        handleHello(c, msg);
        return;
      case "op": {
        c.seenAt = now();
        const changed = applyRemote(room, msg.op);
        if (!changed) return;
        ring(room, msg.op);
        fanOut(room, msg, c);
        if (msg.op.t === "node.add" || msg.op.t === "node.update") enforceSize(room);
        if (msg.op.t === "roster.remove") kick(room, msg.op.id);
        return;
      }
      case "sync.request":
        if (canServeOps(room, msg.since))
          send(c, {
            k: "sync.ops",
            room: room.name,
            ops: room.ops.filter((o) => o.seq >= msg.since),
          });
        else if (room.state) send(c, { k: "sync.snapshot", room: room.name, state: room.state });
        return;
      case "sync.snapshot": {
        const merged = room.state ? mergeStates(room.state, msg.state) : msg.state;
        if (stateChanged(room.state, merged)) {
          setState(room, merged, true);
          enforceSize(room);
          fanOut(room, { k: "sync.snapshot", room: room.name, state: merged }, c);
        }
        return;
      }
      case "sync.ops":
        for (const op of msg.ops) if (applyRemote(room, op)) ring(room, op);
        fanOut(room, msg, c);
        return;
      case "presence":
        c.seenAt = now();
        return;
      case "bye":
        c.left = true;
        broadcastPresence(room);
        return;
      case "cursor":
        c.seenAt = now();
        fanOut(room, msg, c);
        return;
      case "ping":
        fanOut(room, msg, c);
        return;
      case "map.request": {
        fanOut(room, msg, c);
        const cached = room.map;
        if (cached && cached.hash === msg.hash && cached.chunks.size === cached.n) {
          for (let i = 0; i < cached.n; i++) send(c, cached.chunks.get(i)!);
        }
        return;
      }
      case "map.chunk":
        cacheChunk(room, msg);
        fanOut(room, msg, c);
        return;
      case "error":
        return;
    }
  };

  const onConnection = (ws: WebSocket, room: Room) => {
    const c: Client = {
      ws,
      room,
      client: null,
      callsign: "",
      seenAt: now(),
      helloTimer: null,
      bad: 0,
      strikes: 0,
      tokens: RELAY_LIMITS.framesPerSecond,
      tokensAt: now(),
      left: false,
    };
    room.clients.add(c);
    room.lastActive = now();
    if (room.clients.size > RELAY_LIMITS.socketsPerRoom) {
      c.client = asClientId("wd_ZZZZZZZZZZZZ");
      fail(c, "room-full", `This room is full (${RELAY_LIMITS.socketsPerRoom})`, CLOSE_FULL);
      c.client = null;
      return;
    }
    c.helloTimer = setTimeout(() => {
      if (c.client === null) ws.close(CLOSE_HELLO, "hello timeout");
    }, RELAY_LIMITS.helloTimeoutMs);
    ws.on("message", (data: RawData, isBinary: boolean) => {
      const t = now();
      c.tokens = Math.min(
        RELAY_LIMITS.framesPerSecond,
        c.tokens + ((t - c.tokensAt) * RELAY_LIMITS.framesPerSecond) / 1000,
      );
      c.tokensAt = t;
      if (c.tokens < 1) {
        c.strikes++;
        fail(
          c,
          "rate-limit",
          "Slow down",
          c.strikes >= RELAY_LIMITS.rateStrikes ? CLOSE_RATE : null,
        );
        return;
      }
      c.tokens -= 1;
      if (isBinary) {
        c.bad++;
        return;
      }
      const buf = Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(data as ArrayBuffer);
      if (buf.length > WIRE_LIMITS.max) {
        c.bad++;
        if (c.bad >= RELAY_LIMITS.badFrames) fail(c, "bad-frame", "Too many bad frames", CLOSE_BAD);
        return;
      }
      handleFrame(c, buf.toString("utf8"), buf.length);
    });
    ws.on("close", () => {
      if (c.helloTimer !== null) clearTimeout(c.helloTimer);
      room.clients.delete(c);
      room.lastActive = now();
      if (c.client !== null) broadcastPresence(room);
    });
    ws.on("error", () => {
      /* close follows */
    });
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && (req.url === "/healthz" || req.url?.startsWith("/healthz?"))) {
      const body = JSON.stringify({ ok: true, rooms: rooms.size });
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(body);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: WIRE_LIMITS.max });

  const reject = (socket: Socket, status: number, text: string) => {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  };

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    let url: URL;
    try {
      url = new URL(req.url ?? "/", "http://relay");
    } catch {
      return reject(socket, 400, "Bad Request");
    }
    if (url.pathname !== "/ws") return reject(socket, 404, "Not Found");
    const parsed = RelayRoomSchema.safeParse(url.searchParams.get("room") ?? "");
    if (!parsed.success) return reject(socket, 400, "Bad Request");
    if (!originAllowed(req.headers.origin, allowed)) return reject(socket, 403, "Forbidden");
    const name = parsed.data;
    let room = rooms.get(name);
    if (!room) {
      if (rooms.size >= maxRooms) return reject(socket, 503, "Service Unavailable");
      room = {
        name,
        state: null,
        ops: [],
        floor: 0,
        evictedMaxSeq: 0,
        clients: new Set(),
        lastActive: now(),
        map: null,
      };
      rooms.set(name, room);
    }
    const target = room;
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, target));
  });

  const presenceTimer = setInterval(() => {
    for (const room of rooms.values()) if (room.clients.size) broadcastPresence(room);
  }, RELAY_LIMITS.presenceIntervalMs);
  const sweepTimer = setInterval(() => {
    const t = now();
    for (const [name, room] of rooms) {
      if (room.clients.size === 0 && t - room.lastActive > idleMs) rooms.delete(name);
    }
  }, RELAY_LIMITS.idleSweepMs);
  presenceTimer.unref?.();
  sweepTimer.unref?.();

  return {
    server,
    wss,
    rooms,
    listen: (port, host = "0.0.0.0") =>
      new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          const addr = server.address();
          resolve(typeof addr === "object" && addr ? addr.port : port);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(presenceTimer);
        clearInterval(sweepTimer);
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => resolve());
      }),
  };
}

const isMain =
  typeof require !== "undefined" && typeof module !== "undefined" && require.main === module;
if (isMain) {
  const port = Number(process.env.RELAY_PORT ?? process.env.PORT ?? 8787);
  // Behind a reverse proxy or tunnel, bind to loopback so the relay is not reachable on the LAN:
  // the Origin allow-list is a browser guarantee and any other client can forge that header.
  const host = process.env.RELAY_HOST ?? "0.0.0.0";
  const relay = createRelay();
  relay
    .listen(port, host)
    .then((p) =>
      console.log(
        `[relay] listening on ${host}:${p} (origins: ${parseOrigins(process.env.RELAY_ALLOWED_ORIGINS).join(", ") || "none"})`,
      ),
    )
    .catch((e) => {
      console.error("[relay] failed to start", e);
      process.exit(1);
    });
  const shutdown = () => relay.close().then(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
