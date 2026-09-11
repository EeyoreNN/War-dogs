import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOp, createRoomState } from "@/lib/map/reduce";
import {
  A,
  B,
  C,
  baseSettings,
  makeState,
  marker,
  member,
  op,
  request,
} from "@/lib/map/test-fixtures";
import { ONLINE_TTL_MS, type Identity, type Op, type RoomState } from "@/lib/map/types";
import { createMemoryBus, createMemoryTransport } from "@/lib/realtime/memory";
import { roomKey } from "@/lib/storage/keys";
import { demoSeedState, DEMO_BOT_IDS } from "@/lib/map/scenario";
import { setNotifier } from "./notify";
import {
  EMPTY_AFTER_MS,
  PERSIST_DEBOUNCE_MS,
  PING_TTL_MS,
  TICK_MS,
  resetRoomStore,
  selectMe,
  selectNode,
  setTransportFactory,
  useRoomStore,
} from "./room";

const me: Identity = { client: A, callsign: "Alpha", focus: "medic", ink: "blue" };

/** A peer on the bus that keeps its own reduced state (a second browser, without a store). */
function peer(bus: ReturnType<typeof createMemoryBus>, initial: RoomState | null, id: Identity) {
  let state = initial;
  const t = createMemoryTransport(bus, { getState: () => state });
  const received: Op[] = [];
  t.onOp((o) => {
    received.push(o);
    if (state) state = applyOp(state, o);
  });
  t.onSnapshot((s) => {
    state = s;
  });
  return {
    t,
    received,
    get state() {
      return state;
    },
    join: () => t.join("ABC234", id, state?.seq ?? 0, state),
  };
}

describe("room store", () => {
  let bus: ReturnType<typeof createMemoryBus>;
  const notices: string[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    bus = createMemoryBus();
    setTransportFactory((opts) => createMemoryTransport(bus, opts));
    notices.length = 0;
    setNotifier((m) => notices.push(m));
  });
  afterEach(() => {
    resetRoomStore();
    setTransportFactory(null);
    setNotifier(null);
    vi.useRealTimers();
  });

  it("boots empty, shows the empty state after 1.5 s, starts fresh as commander, persists and restores", async () => {
    const store = useRoomStore.getState();
    await store.boot({ code: "ABC234", mode: "room", identity: me });
    expect(useRoomStore.getState().state).toBeNull();
    expect(useRoomStore.getState().awaitingPlan).toBe(false);
    vi.advanceTimersByTime(EMPTY_AFTER_MS + 10);
    expect(useRoomStore.getState().awaitingPlan).toBe(true);
    useRoomStore.getState().startFresh({ team: "Valkyra", map: "ozeti" });
    const s = useRoomStore.getState();
    expect(s.awaitingPlan).toBe(false);
    expect(s.state?.settings.team).toBe("Valkyra");
    expect(s.enemyTeam).toBe("Lonestar");
    expect(selectMe(s)?.role).toBe("commander");
    expect(selectMe(s)?.callsign).toBe("Alpha");
    const opAdd = useRoomStore
      .getState()
      .dispatch({ t: "node.add", nodes: [marker("M1", { author: A })] });
    expect(opAdd?.t).toBe("node.add");
    expect(opAdd?.actor).toBe(A);
    expect(selectNode("M1")(useRoomStore.getState())?.id).toBe("M1");
    expect(selectNode("M1")).toBe(selectNode("M1"));
    expect(localStorage.getItem(roomKey("ABC234"))).toBeNull();
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS + 10);
    expect(localStorage.getItem(roomKey("ABC234"))).not.toBeNull();
    const rooms = JSON.parse(localStorage.getItem("wardogs:rooms")!) as {
      code: string;
      role: string;
    }[];
    expect(rooms[0]).toMatchObject({ code: "ABC234", role: "commander", team: "Valkyra" });
    useRoomStore.getState().leave();
    expect(useRoomStore.getState().state).toBeNull();
    await useRoomStore.getState().boot({ code: "ABC234", mode: "room", identity: me });
    const back = useRoomStore.getState();
    expect(back.state?.nodes.M1).toBeDefined();
    expect(back.awaitingPlan).toBe(false);
    expect(selectMe(back)?.online).toBe(true);
    expect(back.sync).toBe("local");
    expect(back.peers).toBe(1);
  });

  it("a joiner without state gets the holder's snapshot; ops flow both ways; kicks are detected", async () => {
    const held = createRoomState({
      code: "ABC234",
      settings: baseSettings(),
      createdAt: 1,
      actor: B,
    });
    const holder = peer(
      bus,
      applyOp(
        held,
        op(
          { t: "roster.upsert", member: member(B, { role: "commander", callsign: "Bravo" }) },
          2,
          B,
        ),
      ),
      { client: B, callsign: "Bravo", focus: null, ink: "red" },
    );
    await holder.join();
    await useRoomStore.getState().boot({ code: "ABC234", mode: "room", identity: me });
    const s = useRoomStore.getState();
    expect(s.state).not.toBeNull();
    expect(selectMe(s)?.role).toBe("member");
    expect(holder.received.at(-1)?.t).toBe("roster.upsert");
    expect(holder.state?.roster[A]?.callsign).toBe("Alpha");
    expect(s.peers).toBe(2);
    // A remote op arrives through ingest and stamps presence / activity.
    holder.t.send(op({ t: "node.add", nodes: [marker("R1", { author: B })] }, 50, B));
    expect(useRoomStore.getState().state?.nodes.R1).toBeDefined();
    expect(useRoomStore.getState().activity[B]).toBeDefined();
    // My op reaches the holder.
    useRoomStore
      .getState()
      .dispatch({ t: "request.add", request: request("Q1", { by: A, byName: "Alpha" }) });
    expect(holder.state?.requests.Q1).toBeDefined();
    // The commander kicks me.
    holder.t.send(op({ t: "roster.remove", id: A }, 60, B));
    expect(useRoomStore.getState().kicked).toBe(true);
    expect(
      useRoomStore.getState().dispatch({ t: "node.add", nodes: [marker("M2", { author: A })] }),
    ).toBeNull();
  });

  it("dispatch enforces the permission table and caps; undo/redo emit new ops", async () => {
    const base = createRoomState({
      code: "ABC234",
      settings: baseSettings({ drawAccess: "request" }),
      createdAt: 1,
      actor: B,
    });
    const held = applyOp(
      base,
      op({ t: "roster.upsert", member: member(B, { role: "commander", callsign: "Bravo" }) }, 2, B),
    );
    const holder = peer(bus, held, { client: B, callsign: "Bravo", focus: null, ink: "red" });
    await holder.join();
    await useRoomStore.getState().boot({ code: "ABC234", mode: "room", identity: me });
    const st = () => useRoomStore.getState();
    expect(selectMe(st())?.canDraw).toBe(false);
    expect(st().dispatch({ t: "node.add", nodes: [marker("M1", { author: A })] })).toBeNull();
    expect(st().dispatch({ t: "settings.update", patch: { map: "ozeti" } })).toBeNull();
    expect(st().dispatch({ t: "roster.remove", id: B })).toBeNull();
    expect(st().dispatch({ t: "roster.update", id: A, patch: { drawRequested: true } })?.t).toBe(
      "roster.update",
    );
    // Approval from the commander toasts and unlocks drawing.
    holder.t.send(
      op({ t: "roster.update", id: A, patch: { canDraw: true, drawRequested: false } }, 20, B),
    );
    expect(notices).toContain("You can draw now");
    const add = st().dispatch({ t: "node.add", nodes: [marker("M1", { author: A })] });
    expect(add).not.toBeNull();
    expect(st().history.undo.length).toBe(1);
    const sent = holder.received.length;
    st().undo();
    expect(st().state?.nodes.M1).toBeUndefined();
    expect(holder.received.length).toBe(sent + 1);
    expect(holder.received.at(-1)?.t).toBe("node.remove");
    expect(holder.received.at(-1)?.seq).toBeGreaterThan(add!.seq);
    st().redo();
    expect(st().state?.nodes.M1).toBeDefined();
    expect(holder.received.at(-1)?.t).toBe("node.add");
    expect(st().history.undo.length).toBe(1);
    expect(st().history.redo.length).toBe(0);
    // Caps: an oversized body is refused before it reaches the reducer.
    const many = Array.from({ length: 201 }, (_, i) => marker(`X${i}`, { author: A }));
    expect(st().dispatch({ t: "node.add", nodes: many })).toBeNull();
    // A batch undoes as one entry.
    const ops = st().dispatchMany([
      { t: "node.add", nodes: [marker("B1", { author: A })] },
      { t: "node.add", nodes: [marker("B2", { author: A })] },
    ]);
    expect(ops.length).toBe(2);
    expect(st().history.undo.length).toBe(2);
    st().undo();
    expect(st().state?.nodes.B1).toBeUndefined();
    expect(st().state?.nodes.B2).toBeUndefined();
    st().redo();
    expect(st().state?.nodes.B1).toBeDefined();
    expect(st().state?.nodes.B2).toBeDefined();
  });

  it("presence is stamped locally, pings expire, identity updates emit roster.update", async () => {
    useRoomStore.getState().startFresh();
    await useRoomStore.getState().boot({ code: "ABC234", mode: "room", identity: me });
    useRoomStore.getState().startFresh();
    const st = () => useRoomStore.getState();
    st().ingestPresence([{ client: B, callsign: "Bravo", seenAt: 1, cursor: { x: 0.5, y: 0.5 } }]);
    expect(st().presence[B].seenAt).toBe(Date.now());
    expect(st().activity[B]).toBe(Date.now());
    expect(st().peers).toBe(2);
    vi.advanceTimersByTime(31_000);
    expect(st().peers).toBe(1);
    st().ping({ x: 0.2, y: 0.2 });
    expect(st().pings.length).toBe(1);
    expect(st().pings[0].commander).toBe(true);
    vi.advanceTimersByTime(PING_TTL_MS + 10);
    expect(st().pings.length).toBe(0);
    st().updateIdentity({ callsign: "Reaper", focus: "pilot" });
    expect(selectMe(st())?.callsign).toBe("Reaper");
    expect(selectMe(st())?.focus).toBe("pilot");
    expect(JSON.parse(localStorage.getItem("wardogs:identity")!).callsign).toBe("Reaper");
    st().setInk("red");
    expect(selectMe(st())?.ink).toBe("red");
    st().setTool("pen");
    st().setGrid(false);
    expect(JSON.parse(localStorage.getItem("wardogs:prefs")!)).toMatchObject({
      lastTool: "pen",
      grid: false,
    });
  });

  it("the single-writer prunes, flips stale members offline and promotes a successor", async () => {
    let held = createRoomState({
      code: "ABC234",
      settings: baseSettings(),
      createdAt: 1,
      actor: A,
    });
    held = applyOp(
      held,
      op(
        {
          t: "roster.upsert",
          member: member(A, { role: "member", callsign: "Alpha", joinedAt: 5 }),
        },
        2,
        A,
      ),
    );
    held = applyOp(
      held,
      op(
        {
          t: "roster.upsert",
          member: member(C, { role: "commander", callsign: "Charlie", joinedAt: 1 }),
        },
        3,
        C,
      ),
    );
    held = applyOp(
      held,
      op(
        {
          t: "request.add",
          request: request("OLD", { status: "delivered", deliveredAt: Date.now() - 31 * 60_000 }),
        },
        4,
        A,
      ),
    );
    localStorage.setItem(roomKey("ABC234"), JSON.stringify({ v: 1, state: held, savedAt: 1 }));
    await useRoomStore.getState().boot({ code: "ABC234", mode: "room", identity: me });
    const st = () => useRoomStore.getState();
    expect(st().state?.requests.OLD).toBeDefined();
    // Charlie is seen once, then goes quiet. I am the lowest id with presence: the single-writer.
    st().ingestPresence([{ client: C, callsign: "Charlie", seenAt: 0, cursor: null }]);
    vi.advanceTimersByTime(TICK_MS * 2 + 10);
    expect(st().state?.requests.OLD).toBeUndefined();
    expect(st().state?.roster[C].online).toBe(true);
    expect(st().state?.roster[C].role).toBe("commander");
    vi.advanceTimersByTime(ONLINE_TTL_MS + TICK_MS * 2);
    expect(st().state?.roster[C].online).toBe(false);
    expect(selectMe(st())?.role).toBe("commander");
    expect(st().state?.roster[C].role).toBe("member");
    expect(st().pendingPromotion).toBe(false); // my own housekeeping op is not a remote promotion
    expect(st().history.undo.length).toBe(0);
  });

  it("demo mode never persists, runs no housekeeping, and clearMine removes only my things", async () => {
    const seed = demoSeedState(3);
    await useRoomStore
      .getState()
      .boot({ code: "DEMO", mode: "demo", identity: me, room: "DEMO-3", seed });
    const st = () => useRoomStore.getState();
    expect(st().room).toBe("DEMO-3");
    expect(selectMe(st())?.role).toBe("member");
    expect(st().state?.roster[DEMO_BOT_IDS.ossian].role).toBe("commander");
    st().dispatch({ t: "node.add", nodes: [marker("MINE", { author: A })] });
    st().dispatch({ t: "request.add", request: request("RQ", { by: A, byName: "Alpha" }) });
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS * 4);
    expect(localStorage.getItem(roomKey("DEMO"))).toBeNull();
    const before = Object.keys(st().state!.nodes).length;
    vi.advanceTimersByTime(TICK_MS * 4);
    expect(Object.keys(st().state!.nodes).length).toBe(before);
    expect(st().state?.roster[DEMO_BOT_IDS.ossian].role).toBe("commander");
    const removed = st().clearMine();
    expect(removed).toBe(2);
    expect(st().state?.nodes.MINE).toBeUndefined();
    expect(st().state?.requests.RQ).toBeUndefined();
    expect(Object.keys(st().state!.nodes).length).toBe(before - 1);
    // Bot ops enter through ingest and are stale when the same op arrives again.
    const botOp = op(
      { t: "node.add", nodes: [marker("BOT1", { author: DEMO_BOT_IDS.rook })] },
      1000,
      DEMO_BOT_IDS.rook,
    );
    st().ingest(botOp);
    const after = st().state;
    st().ingest(botOp);
    expect(st().state).toBe(after);
  });

  it("a corrupt snapshot is quarantined with a toast; a remote promotion is offered", async () => {
    localStorage.setItem(roomKey("ABC234"), "{nope");
    await useRoomStore.getState().boot({ code: "ABC234", mode: "room", identity: me });
    expect(notices).toContain("Saved plan could not be read; starting fresh");
    expect(localStorage.getItem(roomKey("ABC234") + ":bad")).toBe("{nope");
    useRoomStore.getState().startFresh();
    const st = () => useRoomStore.getState();
    // Make me a member with an absent commander B, then have B's client promote me.
    const s0 = st().state!;
    const withB = applyOp(
      s0,
      op(
        { t: "roster.upsert", member: member(B, { role: "commander", callsign: "Bravo" }) },
        40,
        B,
      ),
    );
    st().ingest(
      op(
        { t: "roster.upsert", member: member(B, { role: "commander", callsign: "Bravo" }) },
        40,
        B,
      ),
    );
    void withB;
    st().ingest(op({ t: "roster.update", id: A, patch: { role: "member" } }, 41, B));
    st().ingest(op({ t: "roster.update", id: A, patch: { role: "commander" } }, 42, B));
    st().ingest(op({ t: "roster.update", id: B, patch: { role: "member" } }, 43, B));
    expect(st().pendingPromotion).toBe(true);
    st().ingestPresence([{ client: B, callsign: "Bravo", seenAt: 0, cursor: null }]);
    st().declinePromotion();
    expect(st().pendingPromotion).toBe(false);
    expect(st().state?.roster[B].role).toBe("commander");
    expect(selectMe(st())?.role).toBe("member");
    void makeState;
  });
});
