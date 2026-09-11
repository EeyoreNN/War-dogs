import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOp } from "../map/reduce";
import { A, B, makeState, marker, op } from "../map/test-fixtures";
import type { RoomState } from "../map/types";
import { backoffDelay, createWsTransport, relayWsUrl, WS_OFFLINE_AFTER, WS_QUEUE_CAP } from "./ws";

class MockSocket {
  static instances: MockSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  sent: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    MockSocket.instances.push(this);
  }
  send(data: string) {
    if (this.readyState !== 1) throw new Error("not open");
    this.sent.push(data);
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  fail() {
    this.readyState = 3;
    this.onclose?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  frames() {
    return this.sent.map((s) => JSON.parse(s) as { k: string; [k: string]: unknown });
  }
}

const identity = { client: A, callsign: "Alpha", focus: null, ink: "blue" as const };

describe("ws transport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockSocket.instances = [];
    vi.stubGlobal("WebSocket", MockSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("builds the relay url", () => {
    expect(relayWsUrl("ws://127.0.0.1:8787/", "ABC234")).toBe("ws://127.0.0.1:8787/ws?room=ABC234");
    expect(relayWsUrl("wss://relay.example", "DEMO-4")).toBe("wss://relay.example/ws?room=DEMO-4");
  });

  it("backoff schedule: min(15000, 500·2^n) ± 20 %", () => {
    expect(backoffDelay(0, () => 0.5)).toBe(500);
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(3, () => 0.5)).toBe(4000);
    expect(backoffDelay(10, () => 0.5)).toBe(15000);
    expect(backoffDelay(0, () => 0)).toBe(400);
    expect(backoffDelay(0, () => 1)).toBe(600);
  });

  it("hello on open, ops queue while closed (cap 1000), sync.request with since on reconnect", async () => {
    let state: RoomState = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    const t = createWsTransport({ relayUrl: "ws://relay", getState: () => state });
    const statuses: string[] = [];
    t.onStatus((s) => statuses.push(s));
    await t.join("ABC234", identity, state.seq, state);
    expect(t.status).toBe("connecting");
    const s1 = MockSocket.instances[0];
    expect(s1.url).toBe("ws://relay/ws?room=ABC234");
    t.send(op({ t: "node.add", nodes: [marker("Q1")] }, 3, A));
    expect(t.pending).toBe(1);
    s1.open();
    expect(t.status).toBe("live");
    const frames = s1.frames();
    expect(frames[0]).toMatchObject({ k: "hello", room: "ABC234", seq: 2 });
    expect((frames[0].snapshot as RoomState).nodes.M1).toBeDefined();
    expect(frames[1]).toMatchObject({ k: "op" });
    expect(t.pending).toBe(0);
    // Inbound frames route to the callbacks; wrong-room and junk frames are dropped.
    const ops: unknown[] = [];
    t.onOp((o) => ops.push(o));
    s1.receive({ k: "op", room: "ABC234", op: op({ t: "node.add", nodes: [marker("R1")] }, 5, B) });
    s1.receive({ k: "op", room: "OTHER1", op: op({ t: "node.add", nodes: [marker("R2")] }, 6, B) });
    s1.onmessage?.({ data: "junk" });
    expect(ops.length).toBe(1);
    // Drop → reconnecting with backoff; ops queue; reconnect sends hello + sync.request{since}.
    state = { ...state, seq: 9 };
    s1.fail();
    expect(t.status).toBe("reconnecting");
    for (let i = 0; i < WS_QUEUE_CAP + 5; i++)
      t.send(op({ t: "node.add", nodes: [marker(`X${i}`)] }, 10 + i, A));
    expect(t.pending).toBe(WS_QUEUE_CAP);
    expect(MockSocket.instances.length).toBe(1);
    vi.advanceTimersByTime(700);
    expect(MockSocket.instances.length).toBe(2);
    const s2 = MockSocket.instances[1];
    s2.open();
    const f2 = s2.frames();
    expect(f2[0]).toMatchObject({ k: "hello", seq: 9 });
    expect(f2[1]).toMatchObject({ k: "sync.request", since: 9 });
    expect(f2.filter((f) => f.k === "op").length).toBe(WS_QUEUE_CAP);
    expect(t.pending).toBe(0);
    expect(statuses).toEqual(
      ["reconnecting", "live", "reconnecting", "live"].slice(-statuses.length),
    );
    t.leave();
    expect(s2.frames().at(-1)).toMatchObject({ k: "bye", client: A });
    expect(s2.readyState).toBe(3);
  });

  it("goes offline after 10 consecutive failures and keeps retrying every 15 s", async () => {
    const t = createWsTransport({ relayUrl: "ws://relay", getState: () => null });
    await t.join("ABC234", identity, 0, null);
    for (let i = 0; i < WS_OFFLINE_AFTER; i++) {
      MockSocket.instances.at(-1)!.fail();
      vi.advanceTimersByTime(20_000);
    }
    expect(t.failures).toBeGreaterThanOrEqual(WS_OFFLINE_AFTER);
    expect(t.status).toBe("offline");
    const before = MockSocket.instances.length;
    MockSocket.instances.at(-1)!.fail();
    vi.advanceTimersByTime(14_000);
    expect(MockSocket.instances.length).toBe(before);
    vi.advanceTimersByTime(1_100);
    expect(MockSocket.instances.length).toBe(before + 1);
    MockSocket.instances.at(-1)!.open();
    expect(t.status).toBe("live");
    expect(t.failures).toBe(0);
    t.leave();
  });

  it("throttles cursor to 50 ms, keeps alive every 20 s, and stops after a kick", async () => {
    const t = createWsTransport({ relayUrl: "ws://relay", getState: () => null });
    await t.join("ABC234", identity, 0, null);
    const s = MockSocket.instances[0];
    s.open();
    const count = () => s.frames().filter((f) => f.k === "cursor").length;
    t.sendEphemeral({ k: "cursor", room: "x", client: A, at: { x: 0.1, y: 0.1 } });
    t.sendEphemeral({ k: "cursor", room: "x", client: A, at: { x: 0.2, y: 0.2 } });
    t.sendEphemeral({ k: "cursor", room: "x", client: A, at: { x: 0.3, y: 0.3 } });
    vi.advanceTimersByTime(60);
    expect(count()).toBe(1);
    expect(s.frames().at(-1)).toMatchObject({
      k: "cursor",
      at: { x: 0.3, y: 0.3 },
      room: "ABC234",
    });
    vi.advanceTimersByTime(20_100);
    expect(count()).toBe(2);
    expect(s.frames().at(-1)).toMatchObject({ k: "cursor", at: null });
    const errors: unknown[] = [];
    t.onError((e) => errors.push(e));
    s.receive({ k: "error", room: "ABC234", code: "kicked", message: "Removed by the commander" });
    expect(errors.length).toBe(1);
    s.fail();
    vi.advanceTimersByTime(60_000);
    expect(MockSocket.instances.length).toBe(1);
  });
});
