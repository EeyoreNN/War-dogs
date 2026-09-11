import { describe, expect, it } from "vitest";
import { applyOp, mergeStates } from "../map/reduce";
import { A, B, makeState, marker, op } from "../map/test-fixtures";
import type { Op, RoomState } from "../map/types";
import { createMemoryBus, createMemoryTransport } from "./memory";

function client(bus: ReturnType<typeof createMemoryBus>, initial: RoomState | null) {
  let state = initial;
  const t = createMemoryTransport(bus, { getState: () => state });
  const received: Op[] = [];
  t.onOp((o) => {
    received.push(o);
    state = state ? applyOp(state, o) : state;
  });
  t.onSnapshot((s) => {
    state = state ? mergeStates(state, s) : s;
  });
  return {
    t,
    received,
    get state() {
      return state;
    },
    set state(s: RoomState | null) {
      state = s;
    },
  };
}

describe("memory transport", () => {
  it("two clients converge on ops and a joiner without state gets a snapshot", async () => {
    const bus = createMemoryBus();
    const seeded = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    const a = client(bus, seeded);
    const b = client(bus, null);
    await a.t.join(
      "ABC234",
      { client: A, callsign: "Alpha", focus: null, ink: "blue" },
      seeded.seq,
      seeded,
    );
    await b.t.join("ABC234", { client: B, callsign: "Bravo", focus: null, ink: "red" }, 0, null);
    expect(b.state).not.toBeNull();
    expect(b.state!.nodes.M1).toBeDefined();
    const o = op({ t: "node.add", nodes: [marker("M2")] }, 3, B);
    b.state = applyOp(b.state!, o);
    b.t.send(o);
    expect(a.received.length).toBe(1);
    expect(a.state!.nodes.M2).toBeDefined();
    expect(a.state!.nodes).toEqual(b.state!.nodes);
    const presence: unknown[] = [];
    a.t.onPresence((p) => presence.push(p));
    const pings: unknown[] = [];
    a.t.onEphemeral((m) => pings.push(m));
    b.t.sendEphemeral({
      k: "ping",
      room: "x",
      ping: {
        id: "PING2222222222AA",
        at: { x: 0.1, y: 0.1 },
        by: B,
        byName: "Bravo",
        color: "red",
        ts: 1,
        commander: false,
      },
    });
    expect(pings.length).toBe(1);
    expect((pings[0] as { room: string }).room).toBe("ABC234");
    b.t.leave();
    b.t.send(op({ t: "node.add", nodes: [marker("M3")] }, 4, B));
    expect(a.received.length).toBe(1);
    expect(a.t.status).toBe("local");
    expect(a.t.kind).toBe("memory");
  });
  it("a returning tab's hello snapshot reaches peers and requestSnapshot is answered", async () => {
    const bus = createMemoryBus();
    const s1 = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    const s2 = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M2")] }, 2, B));
    const a = client(bus, s1);
    const b = client(bus, s2);
    await a.t.join("ABC234", { client: A, callsign: "Alpha", focus: null, ink: "blue" }, 2, s1);
    await b.t.join("ABC234", { client: B, callsign: "Bravo", focus: null, ink: "red" }, 2, s2);
    expect(Object.keys(a.state!.nodes).sort()).toEqual(["M1", "M2"]);
    expect(Object.keys(b.state!.nodes).sort()).toEqual(["M1", "M2"]);
    const c = client(bus, null);
    await c.t.join("ABC234", { client: A, callsign: "Alpha", focus: null, ink: "blue" }, 0, null);
    expect(Object.keys(c.state!.nodes).sort()).toEqual(["M1", "M2"]);
    c.state = null;
    c.t.requestSnapshot(0);
    expect(c.state).not.toBeNull();
    const other = client(bus, null);
    await other.t.join("ZZZ234", { client: B, callsign: "x", focus: null, ink: "red" }, 0, null);
    expect(other.state).toBeNull();
  });
});
