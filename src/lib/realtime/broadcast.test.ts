import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOp } from "../map/reduce";
import { A, B, makeState, marker, op } from "../map/test-fixtures";
import type { RoomState } from "../map/types";
import { channelName, createBroadcastTransport } from "./broadcast";

/** A same-process BroadcastChannel: every instance with the same name hears the others. */
class MockBroadcastChannel {
  static all: MockBroadcastChannel[] = [];
  static posted: { name: string; data: unknown }[] = [];
  listeners = new Set<(e: MessageEvent) => void>();
  closed = false;
  constructor(public name: string) {
    MockBroadcastChannel.all.push(this);
  }
  postMessage(data: unknown) {
    MockBroadcastChannel.posted.push({ name: this.name, data: JSON.parse(JSON.stringify(data)) });
    for (const other of MockBroadcastChannel.all) {
      if (other === this || other.closed || other.name !== this.name) continue;
      const cloned = JSON.parse(JSON.stringify(data));
      for (const l of other.listeners) l({ data: cloned } as MessageEvent);
    }
  }
  addEventListener(_: string, cb: (e: MessageEvent) => void) {
    this.listeners.add(cb);
  }
  removeEventListener(_: string, cb: (e: MessageEvent) => void) {
    this.listeners.delete(cb);
  }
  close() {
    this.closed = true;
  }
}

const idA = { client: A, callsign: "Alpha", focus: null, ink: "blue" as const };
const idB = { client: B, callsign: "Bravo", focus: null, ink: "red" as const };
const kinds = () => MockBroadcastChannel.posted.map((p) => (p.data as { k: string }).k);

describe("broadcast transport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.all = [];
    MockBroadcastChannel.posted = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses the wardogs:<ROOM> channel and falls back to memory without BroadcastChannel", async () => {
    expect(channelName("ABC234")).toBe("wardogs:ABC234");
    vi.stubGlobal("BroadcastChannel", undefined);
    const t = createBroadcastTransport({ getState: () => null });
    expect(t.kind).toBe("memory");
    expect(t.status).toBe("local");
  });

  it("a joiner with no state gets a snapshot from a holder; hello.snapshot reaches onSnapshot", async () => {
    const held = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    const holder = createBroadcastTransport({ getState: () => held });
    await holder.join("ABC234", idA, held.seq, held);
    expect(MockBroadcastChannel.all[0].name).toBe("wardogs:ABC234");
    let joinerState: RoomState | null = null;
    const joiner = createBroadcastTransport({ getState: () => joinerState });
    joiner.onSnapshot((s) => (joinerState = s));
    const presence: unknown[] = [];
    holder.onPresence((p) => presence.push(p));
    const random = vi.spyOn(Math, "random").mockReturnValue(0.1); // the holder answers the hello after 30 ms
    await joiner.join("ABC234", idB, 0, null);
    expect(presence.length).toBe(1);
    expect(joinerState).toBeNull();
    vi.advanceTimersByTime(100);
    random.mockRestore();
    expect(joinerState).not.toBeNull();
    expect((joinerState as unknown as RoomState).nodes.M1).toBeDefined();
    const k = kinds();
    expect(k[0]).toBe("hello");
    expect(k).toContain("sync.snapshot");
    // The holder's reply came from the hello; the joiner never had to ask.
    expect(k.filter((x) => x === "sync.request").length).toBe(0);
    // A returning tab's hello carries its snapshot and reaches the other side's onSnapshot.
    const merged: RoomState[] = [];
    holder.onSnapshot((s) => merged.push(s));
    const back = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M9")] }, 7, B));
    const returning = createBroadcastTransport({ getState: () => back });
    await returning.join("ABC234", idB, 7, back);
    expect(merged.length).toBe(1);
    expect(merged[0].nodes.M9).toBeDefined();
    holder.leave();
    joiner.leave();
    returning.leave();
    expect(kinds().filter((x) => x === "bye").length).toBe(3);
  });

  it("a joiner asks after 300 ms when nobody answered, and a second holder cancels its reply", async () => {
    const held = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    const joiner = createBroadcastTransport({ getState: () => null });
    await joiner.join("ABC234", idB, 0, null);
    vi.advanceTimersByTime(310);
    expect(kinds()).toEqual(["hello", "sync.request"]);
    MockBroadcastChannel.posted = [];
    const h1 = createBroadcastTransport({ getState: () => held });
    const h2 = createBroadcastTransport({ getState: () => held });
    await h1.join("ABC234", idA, 2, held);
    await h2.join("ABC234", idA, 2, held);
    vi.advanceTimersByTime(400);
    MockBroadcastChannel.posted = [];
    const randoms = [0.1, 0.9];
    vi.spyOn(Math, "random").mockImplementation(() => randoms.shift() ?? 0.5);
    joiner.requestSnapshot(0);
    vi.advanceTimersByTime(400);
    expect(kinds().filter((x) => x === "sync.snapshot").length).toBe(1);
    joiner.leave();
    h1.leave();
    h2.leave();
  });

  it("posts presence every 10 s and drops frames for other rooms", async () => {
    const t = createBroadcastTransport({ getState: () => null });
    const ops: unknown[] = [];
    t.onOp((o) => ops.push(o));
    await t.join("ABC234", idA, 0, null);
    vi.advanceTimersByTime(10_050);
    expect(kinds().filter((x) => x === "presence").length).toBe(1);
    const stranger = new MockBroadcastChannel("wardogs:ABC234");
    stranger.postMessage({
      k: "op",
      room: "ZZZ234",
      op: op({ t: "node.add", nodes: [marker("M1")] }, 2, B),
    });
    stranger.postMessage({
      k: "op",
      room: "ABC234",
      op: op({ t: "node.add", nodes: [marker("M1")] }, 2, B),
    });
    stranger.postMessage({ k: "op", room: "ABC234", op: { nope: true } });
    expect(ops.length).toBe(1);
    t.leave();
  });
});
