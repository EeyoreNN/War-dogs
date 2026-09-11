import { describe, expect, it } from "vitest";
import { fieldKey, nodeKey, rosterKey, settingKey } from "./keys";
import { mulberry32 } from "./ids";
import {
  applyOp,
  applyOps,
  canonicalOrder,
  compareRev,
  createRoomState,
  inverseOf,
  isStale,
  mergeStates,
  nextSeq,
  nodesOverCap,
} from "./reduce";
import {
  MAX_NODES,
  MAX_NODES_PER_OP,
  type ClientId,
  type Marker,
  type NodeType,
  type Op,
  type OpBody,
  type RoomState,
} from "./types";
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
  shuffle,
  stroke,
  text,
} from "./test-fixtures";

const mk = (s: RoomState, id = "M1") => s.nodes[id] as Marker;
const stripVolatile = (s: RoomState) => ({
  settings: s.settings,
  nodes: s.nodes,
  order: s.order,
  requests: s.requests,
  roster: s.roster,
});

describe("compareRev / isStale / nextSeq", () => {
  it("orders by seq then actor and is 0 only for the same op", () => {
    expect(compareRev({ seq: 1, actor: B }, { seq: 2, actor: A })).toBeLessThan(0);
    expect(compareRev({ seq: 2, actor: A }, { seq: 2, actor: B })).toBeLessThan(0);
    expect(compareRev({ seq: 2, actor: B }, { seq: 2, actor: A })).toBeGreaterThan(0);
    expect(compareRev({ seq: 2, actor: A }, { seq: 2, actor: A })).toBe(0);
  });
  it("isStale is true for equal and lower revs against revs and tombstones", () => {
    let s = makeState();
    s = applyOp(s, op({ t: "node.add", nodes: [marker("M1")] }, 5, A));
    expect(isStale(s, nodeKey("M1"), { seq: 5, actor: A })).toBe(true);
    expect(isStale(s, nodeKey("M1"), { seq: 4, actor: C })).toBe(true);
    expect(isStale(s, nodeKey("M1"), { seq: 6, actor: A })).toBe(false);
    s = applyOp(s, op({ t: "node.remove", ids: ["M1"] }, 7, B));
    expect(isStale(s, nodeKey("M1"), { seq: 7, actor: A })).toBe(true);
    expect(isStale(s, nodeKey("M1"), { seq: 8, actor: A })).toBe(false);
  });
  it("nextSeq is max(state.seq, incoming) + 1", () => {
    const s = makeState();
    expect(nextSeq(s)).toBe(2);
    expect(nextSeq(s, 10)).toBe(11);
    expect(nextSeq({ ...s, seq: 20 }, 10)).toBe(21);
  });
});

describe("createRoomState", () => {
  it("stamps every settings field with rev {seq 1, actor} and starts at seq 1", () => {
    const s = createRoomState({ code: "ABC234", settings: baseSettings(), createdAt: 5, actor: A });
    expect(s.seq).toBe(1);
    expect(s.v).toBe(1);
    for (const f of [
      "team",
      "map",
      "controlZone",
      "squadMode",
      "squads",
      "drawAccess",
      "mapSource",
    ]) {
      expect(s.revs[settingKey(f)]).toEqual({ seq: 1, actor: A });
    }
    expect(s.order).toEqual([]);
  });
});

describe("applyOp basics", () => {
  it("is idempotent: the same op twice returns the same reference", () => {
    const s0 = makeState();
    const add = op({ t: "node.add", nodes: [marker("M1")] }, 2, A);
    const s1 = applyOp(s0, add);
    expect(s1).not.toBe(s0);
    expect(applyOp(s1, add)).toBe(s1);
    const patch = op({ t: "node.update", id: "M1", patch: { label: "X" } }, 3, A);
    const s2 = applyOp(s1, patch);
    expect(applyOp(s2, patch)).toBe(s2);
  });
  it("ignores a stale op (lower rev than the entity) but still bumps seq", () => {
    let s = makeState();
    s = applyOp(s, op({ t: "node.add", nodes: [marker("M1", { label: "NEW" })] }, 5, A));
    const stale = op({ t: "node.add", nodes: [marker("M1", { label: "OLD" })] }, 3, B);
    const s2 = applyOp(s, stale);
    expect(s2).toBe(s);
    expect(mk(s2).label).toBe("NEW");
    const higherSeqButIgnored = op(
      { t: "node.update", id: "MISSING", patch: { label: "x" } },
      9,
      B,
    );
    const s3 = applyOp(s, higherSeqButIgnored);
    expect(s3).not.toBe(s);
    expect(s3.seq).toBe(9);
    expect(stripVolatile(s3)).toEqual(stripVolatile(s));
  });
  it("seq is monotone and never decreases", () => {
    let s = makeState();
    s = applyOp(s, op({ t: "node.add", nodes: [marker("M1")] }, 10, A));
    expect(s.seq).toBe(10);
    s = applyOp(s, op({ t: "node.add", nodes: [marker("M2")] }, 4, B));
    expect(s.seq).toBe(10);
    expect(s.nodes.M2).toBeDefined();
  });
  it("drops patch keys that do not apply to the node type and returns the same reference when nothing is written", () => {
    let s = makeState();
    s = applyOp(s, op({ t: "node.add", nodes: [stroke("S1")] }, 2, A));
    const s2 = applyOp(
      s,
      op({ t: "node.update", id: "S1", patch: { label: "nope", at: { x: 0, y: 0 } } }, 3, A),
    );
    expect(s2.nodes.S1).toBe(s.nodes.S1);
    expect(stripVolatile(s2)).toEqual(stripVolatile(s));
    const s3 = applyOp(
      s,
      op({ t: "node.update", id: "S1", patch: { color: "red", label: "nope" } }, 3, A),
    );
    expect(s3.nodes.S1).toMatchObject({ color: "red" });
    expect("label" in s3.nodes.S1).toBe(false);
  });
  it("a patch for a missing entity is dropped", () => {
    const s = makeState();
    const s2 = applyOp(s, op({ t: "node.update", id: "M1", patch: { label: "x" } }, 2, A));
    expect(stripVolatile(s2)).toEqual(stripVolatile(s));
    expect(s2.revs[fieldKey("M1", "label")]).toBeUndefined();
  });
  it("caps node.add / node.remove bodies at MAX_NODES_PER_OP", () => {
    const nodes = Array.from({ length: MAX_NODES_PER_OP + 5 }, (_, i) => marker(`M${i}`));
    const s = applyOp(makeState(), op({ t: "node.add", nodes }, 2, A));
    expect(Object.keys(s.nodes).length).toBe(MAX_NODES_PER_OP);
  });
});

describe("concurrent partial patches", () => {
  const seeded = () =>
    applyOp(
      makeState(),
      op({ t: "node.add", nodes: [marker("M1", { label: "FOB", at: { x: 0.1, y: 0.1 } })] }, 2, A),
    );
  const move = op({ t: "node.update", id: "M1", patch: { at: { x: 0.5, y: 0.5 } } }, 10, A);
  const rename = op({ t: "node.update", id: "M1", patch: { label: "DELTA" } }, 11, B);

  it("A moves while B renames: both survive in either order", () => {
    const ab = applyOps(seeded(), [move, rename]);
    const ba = applyOps(seeded(), [rename, move]);
    for (const s of [ab, ba]) {
      expect(s.nodes.M1).toMatchObject({ at: { x: 0.5, y: 0.5 }, label: "DELTA" });
      expect(s.revs[fieldKey("M1", "at")]).toEqual({ seq: 10, actor: A });
      expect(s.revs[fieldKey("M1", "label")]).toEqual({ seq: 11, actor: B });
    }
    expect(stripVolatile(ab)).toEqual(stripVolatile(ba));
  });
  it("same-field patches resolve by rev in either order (seq, then actor)", () => {
    const p1 = op({ t: "node.update", id: "M1", patch: { label: "ONE" } }, 10, B);
    const p2 = op({ t: "node.update", id: "M1", patch: { label: "TWO" } }, 10, A);
    expect(mk(applyOps(seeded(), [p1, p2])).label).toBe("ONE");
    expect(mk(applyOps(seeded(), [p2, p1])).label).toBe("ONE");
    const p3 = op({ t: "node.update", id: "M1", patch: { label: "THREE" } }, 12, A);
    expect(mk(applyOps(seeded(), [p3, p1])).label).toBe("THREE");
    expect(mk(applyOps(seeded(), [p1, p3])).label).toBe("THREE");
  });
  it("a patch may apply partially", () => {
    const s = applyOp(
      seeded(),
      op({ t: "node.update", id: "M1", patch: { label: "LATE" } }, 20, B),
    );
    const s2 = applyOp(
      s,
      op({ t: "node.update", id: "M1", patch: { label: "EARLY", at: { x: 0.9, y: 0.9 } } }, 15, A),
    );
    expect(mk(s2).label).toBe("LATE");
    expect(mk(s2).at).toEqual({ x: 0.9, y: 0.9 });
  });
});

describe("delete beats move regardless of arrival order", () => {
  const seeded = () => applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
  const move = op({ t: "node.update", id: "M1", patch: { at: { x: 0.5, y: 0.5 } } }, 10, A);
  const remove = op({ t: "node.remove", ids: ["M1"] }, 9, B);

  it("patch then remove, and remove then patch, both end without the node and without field revs", () => {
    const a = applyOps(seeded(), [move, remove]);
    const b = applyOps(seeded(), [remove, move]);
    for (const s of [a, b]) {
      expect(s.nodes.M1).toBeUndefined();
      expect(s.tombstones[nodeKey("M1")]).toEqual({ seq: 9, actor: B });
      expect(s.revs[nodeKey("M1")]).toBeUndefined();
      expect(s.revs[fieldKey("M1", "at")]).toBeUndefined();
      expect(s.order).toEqual([]);
    }
    expect(stripVolatile(a)).toEqual(stripVolatile(b));
  });
  it("remove → resurrect → late patch: the resurrected node exists and the later patch applies", () => {
    const resurrect = op({ t: "node.add", nodes: [marker("M1", { label: "BACK" })] }, 12, B);
    const late = op({ t: "node.update", id: "M1", patch: { label: "MOVED" } }, 13, A);
    const s = applyOps(seeded(), [remove, resurrect, late]);
    expect(mk(s).label).toBe("MOVED");
    expect(s.tombstones[nodeKey("M1")]).toBeUndefined();
    const olderPatch = op({ t: "node.update", id: "M1", patch: { label: "OLD" } }, 11, C);
    expect(mk(applyOp(s, olderPatch)).label).toBe("MOVED");
  });
  it("a remove is not blocked by a higher field rev", () => {
    const s = applyOps(seeded(), [
      op({ t: "node.update", id: "M1", patch: { label: "X" } }, 50, A),
    ]);
    const s2 = applyOp(s, op({ t: "node.remove", ids: ["M1"] }, 20, B));
    expect(s2.nodes.M1).toBeUndefined();
  });
});

describe("re-add after delete", () => {
  it("resurrects with a higher rev and clears field revs; a lower re-add is stale", () => {
    let s = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    s = applyOp(s, op({ t: "node.update", id: "M1", patch: { label: "X" } }, 3, A));
    s = applyOp(s, op({ t: "node.remove", ids: ["M1"] }, 4, B));
    const stale = applyOp(
      s,
      op({ t: "node.add", nodes: [marker("M1", { label: "STALE" })] }, 3, C),
    );
    expect(stale.nodes.M1).toBeUndefined();
    const s2 = applyOp(s, op({ t: "node.add", nodes: [marker("M1", { label: "AGAIN" })] }, 5, C));
    expect(mk(s2).label).toBe("AGAIN");
    expect(s2.revs[nodeKey("M1")]).toEqual({ seq: 5, actor: C });
    expect(s2.revs[fieldKey("M1", "label")]).toBeUndefined();
    expect(s2.tombstones[nodeKey("M1")]).toBeUndefined();
    expect(s2.order).toEqual(["M1"]);
  });
  it("a replacing add drops the old generation's field revs", () => {
    let s = applyOp(makeState(), op({ t: "node.add", nodes: [marker("M1")] }, 2, A));
    s = applyOp(s, op({ t: "node.update", id: "M1", patch: { label: "X" } }, 3, A));
    s = applyOp(s, op({ t: "node.add", nodes: [marker("M1", { label: "GEN2" })] }, 4, B));
    expect(mk(s).label).toBe("GEN2");
    expect(s.revs[fieldKey("M1", "label")]).toBeUndefined();
    expect(
      mk(applyOp(s, op({ t: "node.update", id: "M1", patch: { label: "OLDPATCH" } }, 3, C))).label,
    ).toBe("GEN2");
  });
});

describe("layer.clear", () => {
  it("clears by layer with a type filter and races an add correctly", () => {
    let s = applyOp(
      makeState(),
      op(
        {
          t: "node.add",
          nodes: [marker("M1"), stroke("S1"), stroke("S2", { layer: "squad:Alpha" }), text("T1")],
        },
        2,
        A,
      ),
    );
    const clear = op({ t: "layer.clear", layer: "team", types: ["stroke", "text"] }, 5, A);
    s = applyOp(s, clear);
    expect(Object.keys(s.nodes).sort()).toEqual(["M1", "S2"]);
    expect(s.tombstones[nodeKey("S1")]).toEqual({ seq: 5, actor: A });
    // An add that the clear never saw (higher rev) survives; a re-delivered old add is stale.
    const later = op({ t: "node.add", nodes: [stroke("S3")] }, 6, B);
    expect(applyOp(s, later).nodes.S3).toBeDefined();
    const old = op({ t: "node.add", nodes: [stroke("S1")] }, 2, A);
    expect(applyOp(s, old).nodes.S1).toBeUndefined();
    // types: null clears everything on the layer.
    const all = applyOp(s, op({ t: "layer.clear", layer: "team", types: null }, 7, A));
    expect(Object.keys(all.nodes)).toEqual(["S2"]);
  });
  it("a clear against an add with a higher rev leaves that node (the add was not seen)", () => {
    const s0 = applyOp(makeState(), op({ t: "node.add", nodes: [stroke("S1")] }, 2, A));
    const clear = op({ t: "layer.clear", layer: "team", types: null }, 3, A);
    const add = op({ t: "node.add", nodes: [stroke("S2")] }, 4, B);
    const x = applyOps(s0, [clear, add]);
    const y = applyOps(s0, [add, clear]);
    expect(Object.keys(x.nodes)).toEqual(["S2"]);
    expect(stripVolatile(x)).toEqual(stripVolatile(y));
  });
});

describe("requests, roster, settings", () => {
  it("request lifecycle patches converge per field", () => {
    let s = applyOp(makeState(), op({ t: "request.add", request: request("R1") }, 2, A));
    const claim = op(
      {
        t: "request.update",
        id: "R1",
        patch: {
          status: "claimed",
          claimedBy: B,
          claimedByName: "Bravo",
          claimedAt: 5000,
          etaSec: 60,
        },
      },
      5,
      B,
    );
    const note = op({ t: "request.update", id: "R1", patch: { note: "at the LZ" } }, 6, A);
    const ab = applyOps(s, [claim, note]);
    const ba = applyOps(s, [note, claim]);
    expect(stripVolatile(ab)).toEqual(stripVolatile(ba));
    expect(ab.requests.R1).toMatchObject({ status: "claimed", claimedBy: B, note: "at the LZ" });
    s = applyOp(ab, op({ t: "request.remove", id: "R1" }, 7, A));
    expect(s.requests.R1).toBeUndefined();
    expect(applyOp(s, note).requests.R1).toBeUndefined();
  });
  it("roster upsert/update/remove follow the same rules", () => {
    let s = applyOp(
      makeState(),
      op({ t: "roster.upsert", member: member(B, { callsign: "Bravo" }) }, 2, B),
    );
    s = applyOp(
      s,
      op(
        { t: "roster.update", id: B, patch: { focus: "medic", id: "hack" as ClientId } as never },
        3,
        B,
      ),
    );
    expect(s.roster[B].focus).toBe("medic");
    expect(s.roster[B].id).toBe(B);
    expect(s.revs[fieldKey(rosterKey(B), "focus")]).toEqual({ seq: 3, actor: B });
    const removed = applyOp(s, op({ t: "roster.remove", id: B }, 4, A));
    expect(removed.roster[B]).toBeUndefined();
    expect(removed.tombstones[rosterKey(B)]).toEqual({ seq: 4, actor: A });
    expect(
      applyOp(removed, op({ t: "roster.update", id: B, patch: { focus: "pilot" } }, 5, B)).roster[
        B
      ],
    ).toBeUndefined();
    const back = applyOp(removed, op({ t: "roster.upsert", member: member(B) }, 6, B));
    expect(back.roster[B]).toBeDefined();
  });
  it("settings are per-field LWW", () => {
    const s0 = makeState();
    const p1 = op({ t: "settings.update", patch: { map: "ozeti", controlZone: "houses" } }, 5, A);
    const p2 = op({ t: "settings.update", patch: { map: "bakurani" } }, 4, B);
    const x = applyOps(s0, [p1, p2]);
    const y = applyOps(s0, [p2, p1]);
    expect(x.settings).toEqual({ ...baseSettings(), map: "ozeti", controlZone: "houses" });
    expect(stripVolatile(x)).toEqual(stripVolatile(y));
    expect(x.revs[settingKey("map")]).toEqual({ seq: 5, actor: A });
    expect(x.revs[settingKey("team")]).toEqual({ seq: 1, actor: A });
    const stale = op({ t: "settings.update", patch: { team: "Valkyra" } }, 1, A);
    expect(applyOp(x, stale)).toBe(x);
  });
});

describe("order", () => {
  it("is canonical: equal for equal nodes and never a duplicate after a re-add", () => {
    const n1 = marker("M1", { createdAt: 5 });
    const n2 = marker("M2", { createdAt: 3 });
    const n3 = marker("M0", { createdAt: 5 });
    const x = applyOps(makeState(), [
      op({ t: "node.add", nodes: [n1, n2] }, 2, A),
      op({ t: "node.add", nodes: [n3] }, 3, B),
    ]);
    const y = applyOps(makeState(), [
      op({ t: "node.add", nodes: [n3] }, 3, B),
      op({ t: "node.add", nodes: [n2, n1] }, 2, A),
    ]);
    expect(x.order).toEqual(["M2", "M0", "M1"]);
    expect(y.order).toEqual(x.order);
    expect(canonicalOrder(x.nodes)).toEqual(x.order);
    let z = applyOp(x, op({ t: "node.remove", ids: ["M1"] }, 4, A));
    expect(z.order).toEqual(["M2", "M0"]);
    z = applyOp(z, op({ t: "node.add", nodes: [n1] }, 5, A));
    expect(z.order).toEqual(["M2", "M0", "M1"]);
    expect(new Set(z.order).size).toBe(z.order.length);
  });
});

describe("node cap", () => {
  it("drops the oldest strokes without tombstones once nodes exceed MAX_NODES", () => {
    let s = makeState();
    const batches: Op[] = [];
    let seq = 2;
    for (let i = 0; i < MAX_NODES / MAX_NODES_PER_OP; i++) {
      const nodes = Array.from({ length: MAX_NODES_PER_OP }, (_, j) =>
        stroke(`S${i * MAX_NODES_PER_OP + j}`, { createdAt: i * MAX_NODES_PER_OP + j }),
      );
      batches.push(op({ t: "node.add", nodes }, seq++, A));
    }
    s = applyOps(s, batches);
    expect(Object.keys(s.nodes).length).toBe(MAX_NODES);
    const over = applyOp(
      s,
      op(
        {
          t: "node.add",
          nodes: [marker("M1", { createdAt: 99_999 }), stroke("SX", { createdAt: 99_998 })],
        },
        seq++,
        B,
      ),
    );
    expect(Object.keys(over.nodes).length).toBe(MAX_NODES);
    expect(over.nodes.S0).toBeUndefined();
    expect(over.nodes.S1).toBeUndefined();
    expect(over.nodes.M1).toBeDefined();
    expect(over.tombstones[nodeKey("S0")]).toBeUndefined();
    expect(over.revs[nodeKey("S0")]).toBeUndefined();
    expect(nodesOverCap({ ...s.nodes, M1: marker("M1", { createdAt: 99_999 }) })).toEqual(["S0"]);
  });
});

describe("inverseOf", () => {
  const seeded = () =>
    applyOps(makeState(), [
      op(
        { t: "node.add", nodes: [marker("M1", { label: "ONE" }), stroke("S1"), text("T1")] },
        2,
        A,
      ),
      op({ t: "request.add", request: request("R1") }, 3, A),
      op({ t: "roster.upsert", member: member(A) }, 4, A),
    ]);
  const roundTrip = (state: RoomState, body: OpBody, seq: number) => {
    const o = op(body, seq, A);
    const inv = inverseOf(state, o);
    expect(inv).not.toBeNull();
    const after = applyOp(state, o);
    let back = after;
    let n = seq + 1;
    for (const b of inv!) back = applyOp(back, op(b, n++, A));
    expect(stripVolatile(back)).toEqual(stripVolatile(state));
  };
  it("round-trips every invertible op type", () => {
    const s = seeded();
    roundTrip(s, { t: "node.add", nodes: [marker("M9")] }, 10);
    roundTrip(
      s,
      { t: "node.update", id: "M1", patch: { label: "TWO", at: { x: 0.9, y: 0.9 } } },
      10,
    );
    roundTrip(s, { t: "node.remove", ids: ["M1", "S1"] }, 10);
    roundTrip(s, { t: "layer.clear", layer: "team", types: ["stroke", "text"] }, 10);
    roundTrip(s, { t: "layer.clear", layer: "team", types: null }, 10);
    roundTrip(s, { t: "request.add", request: request("R2") }, 10);
    roundTrip(
      s,
      { t: "request.update", id: "R1", patch: { status: "claimed", claimedBy: B, note: "x" } },
      10,
    );
    roundTrip(s, { t: "request.remove", id: "R1" }, 10);
  });
  it("returns null for roster and settings ops", () => {
    const s = seeded();
    expect(
      inverseOf(s, op({ t: "roster.update", id: A, patch: { focus: "medic" } }, 10, A)),
    ).toBeNull();
    expect(inverseOf(s, op({ t: "roster.upsert", member: member(B) }, 10, A))).toBeNull();
    expect(inverseOf(s, op({ t: "roster.remove", id: A }, 10, A))).toBeNull();
    expect(inverseOf(s, op({ t: "settings.update", patch: { map: "ozeti" } }, 10, A))).toBeNull();
  });
  it("node.update inverse carries only the keys that actually change", () => {
    const s = seeded();
    const inv = inverseOf(
      s,
      op({ t: "node.update", id: "M1", patch: { label: "X", color: "red" } as never }, 10, A),
    );
    expect(inv).toEqual([{ t: "node.update", id: "M1", patch: { label: "ONE" } }]);
    expect(
      inverseOf(s, op({ t: "node.update", id: "NOPE", patch: { label: "X" } }, 10, A)),
    ).toEqual([]);
  });
  it("batches at MAX_NODES_PER_OP", () => {
    const nodes = Array.from({ length: MAX_NODES_PER_OP * 2 + 1 }, (_, i) => stroke(`S${i}`));
    let s = makeState();
    let seq = 2;
    for (let i = 0; i < nodes.length; i += MAX_NODES_PER_OP) {
      s = applyOp(s, op({ t: "node.add", nodes: nodes.slice(i, i + MAX_NODES_PER_OP) }, seq++, A));
    }
    const inv = inverseOf(s, op({ t: "layer.clear", layer: "team", types: null }, 50, A))!;
    expect(inv.length).toBe(3);
    expect(inv.map((b) => (b.t === "node.add" ? b.nodes.length : -1))).toEqual([
      MAX_NODES_PER_OP,
      MAX_NODES_PER_OP,
      1,
    ]);
    const inv2 = inverseOf(
      s,
      op({ t: "node.remove", ids: nodes.map((n) => n.id).slice(0, MAX_NODES_PER_OP) }, 50, A),
    )!;
    expect(inv2.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Causally valid random histories (§3.4): every patch's rev is greater than the add it saw and
// permutations keep each entity's add before its patches, a layer.clear after everything the
// clearing actor had seen and node patches after the last clear they saw; everything else
// shuffles freely: concurrent patches to the same and different fields, removes racing patches,
// resurrecting adds, layer.clear racing later adds.

interface Hist {
  ops: Op[];
  /** deps[i] = indexes that must come before op i. */
  deps: number[][];
}

const ACTORS: ClientId[] = [A, B, C];
const LAYERS = ["team", "squad:Alpha"] as const;

function randomHistory(seed: number, count: number): Hist {
  const rnd = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const ops: Op[] = [];
  const deps: number[][] = [];
  let state = makeState();
  let clock = 1;
  let nextId = 0;
  /** latest add index per entity key, present while the entity exists in the generation state. */
  const latestAdd = new Map<string, number>();
  const removedNodes: string[] = [];
  /** Index of the last layer.clear: a node patch emitted after it saw it, so it stays behind it. */
  let lastClear = -1;
  const nodeDeps = (id: string) =>
    lastClear >= 0 ? [latestAdd.get(nodeKey(id))!, lastClear] : [latestAdd.get(nodeKey(id))!];
  const push = (body: OpBody, actor: ClientId, dep: number[], seq?: number) => {
    const o = op(body, seq ?? ++clock, actor);
    if (seq !== undefined) clock = Math.max(clock, seq);
    ops.push(o);
    deps.push(dep);
    state = applyOp(state, o);
    return ops.length - 1;
  };
  const nodeIds = () => Object.keys(state.nodes);
  const reqIds = () => Object.keys(state.requests);
  const rosterIds = () => Object.keys(state.roster) as ClientId[];
  const newNode = (id: string) => {
    const layer = pick(LAYERS);
    const createdAt = 1_000 + Math.floor(rnd() * 5000);
    switch (Math.floor(rnd() * 3)) {
      case 0:
        return marker(id, { layer, createdAt, at: { x: rnd(), y: rnd() } });
      case 1:
        return stroke(id, { layer, createdAt });
      default:
        return text(id, { layer, createdAt });
    }
  };
  const patchFor = (id: string): OpBody => {
    const n = state.nodes[id];
    const choices: (() => OpBody)[] = [
      () => ({ t: "node.update", id, patch: { layer: pick(LAYERS) } }),
      () => ({ t: "node.update", id, patch: { color: pick(["red", "blue", "green"] as const) } }),
    ];
    if (n.t === "marker") {
      choices.push(() => ({
        t: "node.update",
        id,
        patch: { label: `L${Math.floor(rnd() * 100)}` },
      }));
      choices.push(() => ({ t: "node.update", id, patch: { at: { x: rnd(), y: rnd() } } }));
    }
    if (n.t === "text")
      choices.push(() => ({
        t: "node.update",
        id,
        patch: { text: `T${Math.floor(rnd() * 100)}`, size: "lg" },
      }));
    if (n.t === "stroke")
      choices.push(() => ({
        t: "node.update",
        id,
        patch: {
          points: [
            { x: rnd(), y: rnd() },
            { x: rnd(), y: rnd() },
          ],
        },
      }));
    return pick(choices)();
  };
  const patchReq = (id: string): OpBody => ({
    t: "request.update",
    id,
    patch: pick([
      { status: "claimed" as const, claimedBy: B, claimedByName: "Bravo" },
      { note: `n${Math.floor(rnd() * 50)}` },
      { priority: "urgent" as const },
      { etaSec: Math.floor(rnd() * 300) },
    ]),
  });

  while (ops.length < count) {
    const actor = pick(ACTORS);
    const r = rnd();
    if (r < 0.28 || nodeIds().length === 0) {
      const id = `N${nextId++}`;
      const i = push({ t: "node.add", nodes: [newNode(id)] }, actor, []);
      latestAdd.set(nodeKey(id), i);
    } else if (r < 0.52) {
      const id = pick(nodeIds());
      push(patchFor(id), actor, nodeDeps(id));
    } else if (r < 0.6) {
      // Two concurrent patches with the same seq from different actors (tie-break by actor).
      const id = pick(nodeIds());
      const dep = nodeDeps(id);
      const seq = clock + 1;
      const [x, y] = shuffle(ACTORS, Math.floor(rnd() * 1e9));
      push(patchFor(id), x, dep, seq);
      push(patchFor(id), y, dep, seq);
    } else if (r < 0.68) {
      const ids = shuffle(nodeIds(), Math.floor(rnd() * 1e9)).slice(0, 1 + Math.floor(rnd() * 2));
      push({ t: "node.remove", ids }, actor, []);
      for (const id of ids) {
        latestAdd.delete(nodeKey(id));
        removedNodes.push(id);
      }
    } else if (r < 0.74 && removedNodes.length) {
      const id = removedNodes.splice(Math.floor(rnd() * removedNodes.length), 1)[0];
      const i = push({ t: "node.add", nodes: [newNode(id)] }, actor, []);
      latestAdd.set(nodeKey(id), i);
    } else if (r < 0.78) {
      const layer = pick(LAYERS);
      const types: NodeType[] | null =
        rnd() < 0.5 ? null : [pick(["marker", "stroke", "text"] as const)];
      const cleared = nodeIds().filter(
        (id) =>
          state.nodes[id].layer === layer && (types === null || types.includes(state.nodes[id].t)),
      );
      // The clearing actor saw every earlier add, remove and layer move, so causal delivery puts
      // all of them before the clear; later adds and removes race it freely (rev decides).
      lastClear = push(
        { t: "layer.clear", layer, types },
        actor,
        ops.map((_, i) => i),
      );
      for (const id of cleared) {
        latestAdd.delete(nodeKey(id));
        removedNodes.push(id);
      }
    } else if (r < 0.84) {
      const id = `R${nextId++}`;
      const i = push(
        { t: "request.add", request: request(id, { by: actor, createdAt: 1_000 + nextId }) },
        actor,
        [],
      );
      latestAdd.set(nodeKey(id), i);
    } else if (r < 0.9 && reqIds().length) {
      const id = pick(reqIds());
      if (rnd() < 0.8) push(patchReq(id), actor, [latestAdd.get(nodeKey(id))!]);
      else {
        push({ t: "request.remove", id }, actor, []);
        latestAdd.delete(nodeKey(id));
      }
    } else if (r < 0.95) {
      const who = pick(ACTORS);
      if (state.roster[who] && rnd() < 0.7)
        push(
          {
            t: "roster.update",
            id: who,
            patch: { focus: pick(["medic", "pilot", null] as const) },
          },
          actor,
          [latestAdd.get(rosterKey(who))!],
        );
      else {
        const i = push(
          { t: "roster.upsert", member: member(who, { callsign: `c${nextId++}` }) },
          actor,
          [],
        );
        latestAdd.set(rosterKey(who), i);
      }
    } else {
      push(
        {
          t: "settings.update",
          patch: pick([
            { map: "ozeti" as const },
            { controlZone: "houses" as const },
            { drawAccess: "request" as const },
          ]),
        },
        actor,
        [],
      );
    }
  }
  return { ops: ops.slice(0, count), deps: deps.slice(0, count) };
}

/** A random topological order of the history that respects `deps`. */
function causalPermutation(h: Hist, seed: number): Op[] {
  const rnd = mulberry32(seed);
  const n = h.ops.length;
  const placed = new Array<boolean>(n).fill(false);
  const out: Op[] = [];
  const ready = () => {
    const xs: number[] = [];
    for (let i = 0; i < n; i++)
      if (!placed[i] && h.deps[i].every((d) => d >= n || placed[d])) xs.push(i);
    return xs;
  };
  while (out.length < n) {
    const xs = ready();
    const i = xs[Math.floor(rnd() * xs.length)];
    placed[i] = true;
    out.push(h.ops[i]);
  }
  return out;
}

/** A random causal cut: a deps-closed subset in its generation order. */
function causalCut(h: Hist, seed: number): Op[] {
  const rnd = mulberry32(seed);
  const keep = new Array<boolean>(h.ops.length).fill(false);
  for (let i = 0; i < h.ops.length; i++) keep[i] = rnd() < 0.6;
  // Close under deps.
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < h.ops.length; i++)
      if (keep[i]) for (const d of h.deps[i]) if (d < h.ops.length) keep[d] = true;
  return h.ops.filter((_, i) => keep[i]);
}

describe("convergence", () => {
  it("200 causally valid random ops from 3 actors converge under 20 seeded permutations", () => {
    for (const seed of [1, 2, 3]) {
      const h = randomHistory(seed, 200);
      expect(h.ops.length).toBe(200);
      const reference = applyOps(makeState(), h.ops);
      expect(Object.keys(reference.nodes).length).toBeGreaterThan(0);
      for (let p = 0; p < 20; p++) {
        const perm = causalPermutation(h, seed * 1000 + p);
        const s = applyOps(makeState(), perm);
        expect(s).toEqual(reference);
      }
    }
  });
  it("mergeStates is commutative, associative and idempotent", () => {
    for (const seed of [11, 12, 13, 14]) {
      const h = randomHistory(seed, 160);
      const a = applyOps(makeState(), causalCut(h, seed + 1));
      const b = applyOps(makeState(), causalCut(h, seed + 2));
      const c = applyOps(makeState(), causalCut(h, seed + 3));
      expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
      expect(mergeStates(mergeStates(a, b), c)).toEqual(mergeStates(a, mergeStates(b, c)));
      expect(mergeStates(a, a)).toEqual(a);
      expect(mergeStates(mergeStates(a, b), b)).toEqual(mergeStates(a, b));
    }
  });
  it("mergeStates(a, applyOps(a, ops)) equals applyOps(a, ops)", () => {
    for (const seed of [21, 22]) {
      const h = randomHistory(seed, 150);
      const a = applyOps(makeState(), h.ops.slice(0, 60));
      const later = applyOps(a, h.ops.slice(60));
      expect(mergeStates(a, later)).toEqual(later);
      expect(mergeStates(later, a)).toEqual(later);
    }
  });
  it("mergeStates keeps a field patched after the winning add and drops replaced-generation revs", () => {
    const s0 = applyOp(
      makeState(),
      op({ t: "node.add", nodes: [marker("M1", { label: "ONE" })] }, 2, A),
    );
    const a = applyOp(s0, op({ t: "node.update", id: "M1", patch: { label: "PATCHED" } }, 5, A));
    const b = applyOps(s0, [
      op({ t: "node.remove", ids: ["M1"] }, 3, B),
      op({ t: "node.add", nodes: [marker("M1", { label: "GEN2" })] }, 4, B),
    ]);
    const m = mergeStates(a, b);
    expect(mk(m).label).toBe("PATCHED");
    expect(m.revs[nodeKey("M1")]).toEqual({ seq: 4, actor: B });
    expect(m.revs[fieldKey("M1", "label")]).toEqual({ seq: 5, actor: A });
    expect(m.tombstones[nodeKey("M1")]).toBeUndefined();
    const c = applyOp(s0, op({ t: "node.update", id: "M1", patch: { label: "OLDGEN" } }, 3, C));
    const m2 = mergeStates(c, b);
    expect(mk(m2).label).toBe("GEN2");
    expect(m2.revs[fieldKey("M1", "label")]).toBeUndefined();
    // A tombstone above every entity rev wins and is kept.
    const d = applyOp(s0, op({ t: "node.remove", ids: ["M1"] }, 9, C));
    const m3 = mergeStates(a, d);
    expect(m3.nodes.M1).toBeUndefined();
    expect(m3.tombstones[nodeKey("M1")]).toEqual({ seq: 9, actor: C });
    expect(m3.revs[fieldKey("M1", "label")]).toBeUndefined();
    expect(m3.order).toEqual([]);
  });
  it("mergeStates merges settings per field, takes min createdAt, max seq and the first code", () => {
    const a = createRoomState({
      code: "ABC234",
      settings: baseSettings(),
      createdAt: 10,
      actor: A,
    });
    const b = createRoomState({
      code: "ABC234",
      settings: baseSettings({ map: "ozeti" }),
      createdAt: 5,
      actor: B,
    });
    const a2 = applyOp(a, op({ t: "settings.update", patch: { controlZone: "houses" } }, 7, A));
    const m = mergeStates(a2, b);
    expect(m.settings.map).toBe("ozeti"); // (1, B) beats (1, A)
    expect(m.settings.controlZone).toBe("houses");
    expect(m.createdAt).toBe(5);
    expect(m.seq).toBe(7);
    expect(m.code).toBe("ABC234");
    expect(m).toEqual(mergeStates(b, a2));
  });
});
