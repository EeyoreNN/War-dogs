// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { applyOps } from "../src/lib/map/reduce";
import { A, B, C, makeState, marker, op, stroke } from "../src/lib/map/test-fixtures";
import type { RoomState } from "../src/lib/map/types";
import type { WireMessage } from "../src/lib/realtime/transport";
import { createRelay, RELAY_LIMITS, type Relay } from "./relay";

const ORIGIN = "http://allowed.test";
let relay: Relay;
let port = 0;

interface Client {
  ws: WebSocket;
  inbox: WireMessage[];
  next(pred: (m: WireMessage) => boolean, timeoutMs?: number): Promise<WireMessage>;
  send(msg: unknown): void;
  closed: Promise<number>;
}

function connect(room: string, origin: string | null = ORIGIN): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`, origin ? { origin } : {});
    const inbox: WireMessage[] = [];
    const waiters: { pred: (m: WireMessage) => boolean; resolve: (m: WireMessage) => void }[] = [];
    let closeResolve: (code: number) => void = () => {};
    const closed = new Promise<number>((r) => (closeResolve = r));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as WireMessage;
      const i = waiters.findIndex((w) => w.pred(msg));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
      else inbox.push(msg);
    });
    ws.on("close", (code) => closeResolve(code));
    ws.on("error", reject);
    ws.on("open", () =>
      resolve({
        ws,
        inbox,
        closed,
        send: (msg) => ws.send(typeof msg === "string" ? msg : JSON.stringify(msg)),
        next: (pred, timeoutMs = 3000) =>
          new Promise((res, rej) => {
            const i = inbox.findIndex(pred);
            if (i >= 0) return res(inbox.splice(i, 1)[0]);
            const timer = setTimeout(() => rej(new Error("timeout waiting for frame")), timeoutMs);
            waiters.push({
              pred,
              resolve: (m) => {
                clearTimeout(timer);
                res(m);
              },
            });
          }),
      }),
    );
  });
}

const upgradeStatus = (room: string, origin: string | null = ORIGIN): Promise<number | "open"> =>
  new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`, origin ? { origin } : {});
    ws.on("open", () => {
      ws.close();
      resolve("open");
    });
    ws.on("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
    ws.on("error", () => {});
  });

const identity = (client: string, callsign: string) => ({
  client,
  callsign,
  focus: null,
  ink: "blue",
});
const hello = (
  room: string,
  client: string,
  callsign: string,
  seq = 0,
  snapshot: RoomState | null = null,
) => ({ k: "hello", room, identity: identity(client, callsign), seq, snapshot });

function bigState(): RoomState {
  const pts = Array.from({ length: 400 }, (_, i) => ({
    x: (i % 100) / 100,
    y: Math.floor(i / 100) / 10,
  }));
  let s = makeState(A, "BGGY22");
  for (let i = 0; i < 120; i += 100) {
    s = applyOps(s, [
      op(
        {
          t: "node.add",
          nodes: Array.from({ length: Math.min(100, 120 - i) }, (_, j) =>
            stroke(`S${i + j}`, { points: pts }),
          ),
        },
        2 + i,
        A,
      ),
    ]);
  }
  return s;
}

beforeAll(async () => {
  relay = createRelay({ allowedOrigins: [ORIGIN] });
  port = await relay.listen(0, "127.0.0.1");
});
afterAll(async () => {
  await relay.close();
});

describe("relay", () => {
  it("GET /healthz reports rooms; anything else is 404", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, rooms: expect.any(Number) });
    expect((await fetch(`http://127.0.0.1:${port}/nope`)).status).toBe(404);
  });

  it("rejects bad rooms and origins before the upgrade; accepts DEMO-<n>", async () => {
    expect(await upgradeStatus("SIM")).toBe(400);
    expect(await upgradeStatus("ABC234", "http://evil.test")).toBe(403);
    expect(await upgradeStatus("ABC234", null)).toBe(403);
    expect(await upgradeStatus("DEMO-12")).toBe("open");
    expect(await upgradeStatus("abc234")).toBe("open");
  });

  it("hello → snapshot, op fan-out in one order, sync.request → sync.ops with seq >= since, presence de-duplicated", async () => {
    const room = "ABC234";
    const state = applyOps(makeState(A, room), [
      op({ t: "node.add", nodes: [marker("M1")] }, 2, A),
    ]);
    const a = await connect(room);
    a.send(hello(room, A, "Alpha", state.seq, state));
    const snapA = await a.next((m) => m.k === "sync.snapshot");
    expect(snapA.k === "sync.snapshot" && snapA.state.nodes.M1).toBeTruthy();
    await a.next((m) => m.k === "presence");

    const b = await connect(room);
    b.send(hello(room, B, "Bravo"));
    const snapB = await b.next((m) => m.k === "sync.snapshot");
    expect(snapB.k === "sync.snapshot" && Object.keys(snapB.state.nodes)).toEqual(["M1"]);
    const presence = await a.next((m) => m.k === "presence" && m.members.length === 2);
    expect(presence.k === "presence" && presence.members.map((m) => m.client).sort()).toEqual(
      [A, B].sort(),
    );

    // A second tab of A is the same member: presence stays at two.
    const a2 = await connect(room);
    a2.send(hello(room, A, "Alpha"));
    await a2.next((m) => m.k === "sync.snapshot");
    const dedup = await b.next((m) => m.k === "presence" && m.members.length === 2);
    expect(dedup.k === "presence" && dedup.members.length).toBe(2);

    // Ops fan out to everyone else in arrival order; the sender does not get its own op back.
    const o1 = op({ t: "node.add", nodes: [marker("M2")] }, 10, A);
    const o2 = op({ t: "node.add", nodes: [marker("M3")] }, 11, A);
    a.send({ k: "op", room, op: o1 });
    a.send({ k: "op", room, op: o2 });
    const gotB1 = await b.next((m) => m.k === "op");
    const gotB2 = await b.next((m) => m.k === "op");
    expect([gotB1, gotB2].map((m) => (m.k === "op" ? m.op.seq : -1))).toEqual([10, 11]);
    const gotA2 = await a2.next((m) => m.k === "op");
    expect(gotA2.k === "op" && gotA2.op.seq).toBe(10);
    // A stale re-delivery is absorbed, not fanned out.
    a.send({ k: "op", room, op: o1 });
    b.send({ k: "sync.request", room, since: 11 });
    const ops = await b.next((m) => m.k === "sync.ops");
    expect(ops.k === "sync.ops" && ops.ops.map((o) => o.seq)).toEqual([11]);
    b.send({ k: "sync.request", room, since: 1 });
    const snap = await b.next((m) => m.k === "sync.snapshot");
    expect(snap.k === "sync.snapshot" && Object.keys(snap.state.nodes).sort()).toEqual([
      "M1",
      "M2",
      "M3",
    ]);
    expect(a.inbox.filter((m) => m.k === "op").length).toBe(0);

    // Leaving broadcasts presence without the leaver.
    b.ws.close();
    const after = await a.next((m) => m.k === "presence" && m.members.every((x) => x.client !== B));
    expect(after.k === "presence" && after.members.map((m) => m.client)).toEqual([A]);
    a.ws.close();
    a2.ws.close();
  });

  it("ping and cursor fan out; cursor refreshes presence; wrong-room and bad frames are dropped", async () => {
    const room = "PNGS22";
    const a = await connect(room);
    const b = await connect(room);
    a.send(hello(room, A, "Alpha"));
    b.send(hello(room, B, "Bravo"));
    await a.next((m) => m.k === "presence" && m.members.length === 2);
    a.send({
      k: "ping",
      room,
      ping: {
        id: "PING2222222222AA",
        at: { x: 0.1, y: 0.1 },
        by: A,
        byName: "Alpha",
        color: "red",
        ts: 1,
        commander: false,
      },
    });
    const ping = await b.next((m) => m.k === "ping");
    expect(ping.k).toBe("ping");
    a.send({ k: "cursor", room, client: A, at: { x: 0.5, y: 0.5 } });
    const cur = await b.next((m) => m.k === "cursor");
    expect(cur.k === "cursor" && cur.at).toEqual({ x: 0.5, y: 0.5 });
    a.send({ k: "cursor", room: "OTHER2", client: A, at: null });
    a.send("not json");
    a.send({ k: "op", room, op: { nope: true } });
    a.send({ k: "cursor", room, client: A, at: null });
    const again = await b.next((m) => m.k === "cursor");
    expect(again.k === "cursor" && again.at).toBeNull();
    expect(b.inbox.filter((m) => m.k === "cursor").length).toBe(0);
    a.ws.close();
    b.ws.close();
  });

  it("closes a socket after 20 bad frames and rate-limits at 60 frames per second", async () => {
    const room = "BADFRM";
    const a = await connect(room);
    a.send(hello(room, A, "Alpha"));
    for (let i = 0; i < RELAY_LIMITS.badFrames; i++) a.send("junk");
    const err = await a.next((m) => m.k === "error");
    expect(err.k === "error" && err.code).toBe("bad-frame");
    expect(await a.closed).toBe(4002);

    const b = await connect(room);
    b.send(hello(room, B, "Bravo"));
    await b.next((m) => m.k === "presence");
    for (let i = 0; i < RELAY_LIMITS.framesPerSecond + 5; i++)
      b.send({ k: "cursor", room, client: B, at: null });
    const limited = await b.next((m) => m.k === "error");
    expect(limited.k === "error" && limited.code).toBe("rate-limit");
    for (let i = 0; i < 5; i++) b.send({ k: "cursor", room, client: B, at: null });
    expect(await b.closed).toBe(4029);
  });

  it("accepts a 1 MB hello snapshot and trims a room that outgrows MAX_STATE_BYTES", async () => {
    const room = "BGGY22";
    const big = bigState();
    const frame = JSON.stringify(hello(room, A, "Alpha", big.seq, big));
    expect(frame.length).toBeGreaterThan(900_000);
    const a = await connect(room);
    a.send(frame);
    const snap = await a.next((m) => m.k === "sync.snapshot", 10_000);
    expect(snap.k === "sync.snapshot" && Object.keys(snap.state.nodes).length).toBeLessThan(120);
    const removes = a.inbox.filter((m) => m.k === "op" && m.op.t === "node.remove");
    expect(removes.length).toBeGreaterThan(0);
    const st = relay.rooms.get(room)!.state!;
    expect(JSON.stringify(st).length).toBeLessThanOrEqual(600_000);
    a.ws.close();
  });

  it("refuses the 65th socket with room-full", async () => {
    const room = "FULL22";
    const clients: Client[] = [];
    for (let i = 0; i < RELAY_LIMITS.socketsPerRoom; i++) clients.push(await connect(room));
    const extra = await connect(room);
    const err = await extra.next((m) => m.k === "error");
    expect(err.k === "error" && err.code).toBe("room-full");
    expect(await extra.closed).toBe(4013);
    for (const c of clients) c.ws.close();
  });

  it("a kick closes every socket of that client with error kicked", async () => {
    const room = "KCKD22";
    const a = await connect(room);
    const b1 = await connect(room);
    const b2 = await connect(room);
    const state = makeState(A, room);
    a.send(hello(room, A, "Alpha", state.seq, state));
    b1.send(hello(room, B, "Bravo"));
    b2.send(hello(room, B, "Bravo"));
    await b2.next((m) => m.k === "sync.snapshot");
    a.send({
      k: "op",
      room,
      op: op(
        {
          t: "roster.upsert",
          member: {
            id: B,
            callsign: "Bravo",
            role: "member",
            focus: null,
            online: true,
            ink: "red",
            canDraw: true,
            drawRequested: false,
            joinedAt: 1,
            lastSeen: 1,
          },
        },
        5,
        B,
      ),
    });
    a.send({ k: "op", room, op: op({ t: "roster.remove", id: B }, 6, A) });
    const [e1, e2] = await Promise.all([
      b1.next((m) => m.k === "error"),
      b2.next((m) => m.k === "error"),
    ]);
    expect(e1.k === "error" && e1.code).toBe("kicked");
    expect(e2.k === "error" && e2.code).toBe("kicked");
    expect(await b1.closed).toBe(4003);
    expect(await b2.closed).toBe(4003);
    const c = await connect(room);
    c.send(hello(room, C, "Charlie"));
    const snap = await c.next((m) => m.k === "sync.snapshot");
    expect(snap.k === "sync.snapshot" && snap.state.roster[B]).toBeUndefined();
    a.ws.close();
    c.ws.close();
  });

  it("caches the uploaded map and answers a later map.request from the cache", async () => {
    const room = "MAPS22";
    const a = await connect(room);
    const b = await connect(room);
    a.send(hello(room, A, "Alpha"));
    b.send(hello(room, B, "Bravo"));
    await a.next((m) => m.k === "presence" && m.members.length === 2);
    const hash = "ab".repeat(32);
    const chunk = (i: number) => ({
      k: "map.chunk",
      room,
      hash,
      i,
      n: 2,
      mime: "image/jpeg",
      w: 1024,
      h: 1024,
      data: "QUJD",
    });
    a.send(chunk(0));
    a.send(chunk(1));
    await b.next((m) => m.k === "map.chunk" && m.i === 1);
    b.send({ k: "map.request", room, hash });
    const c0 = await b.next((m) => m.k === "map.chunk" && m.i === 0);
    expect(c0.k).toBe("map.chunk");
    const reqAtA = await a.next((m) => m.k === "map.request");
    expect(reqAtA.k === "map.request" && reqAtA.hash).toBe(hash);
    a.ws.close();
    b.ws.close();
  });

  it("closes a socket that never says hello", async () => {
    const room = "SLNT22";
    const a = await connect(room);
    const code = await Promise.race([
      a.closed,
      new Promise<number>((r) => setTimeout(() => r(-1), RELAY_LIMITS.helloTimeoutMs + 1500)),
    ]);
    expect(code).toBe(4008);
  }, 10_000);
});
