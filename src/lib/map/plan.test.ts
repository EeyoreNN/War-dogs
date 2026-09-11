import { describe, expect, it } from "vitest";
import { applyOp, applyOps } from "./reduce";
import { demoSeedState, DEMO_EPOCH_MS } from "./scenario";
import {
  formatAge,
  formatPlanDate,
  importPlan,
  layersOf,
  planToSnapshot,
  planToText,
} from "./plan";
import { A, B, makeState, marker, op, stroke } from "./test-fixtures";
import { MAX_NODES_PER_OP, type Measurement } from "./types";

const measureNode: Measurement = {
  id: "MS22222222222222",
  layer: "team",
  author: A,
  authorName: "Alpha",
  createdAt: 1,
  t: "measure",
  a: { x: 0, y: 0.5 },
  b: { x: 0.5, y: 0.5 },
  color: "white",
};

describe("plan", () => {
  it("planToText for the demo seed matches the snapshot", () => {
    const text = planToText(demoSeedState(1), "Zestafona", DEMO_EPOCH_MS + 30_000);
    expect(text).toMatchSnapshot();
    expect(text).toContain('FOB "AUSTIN" · VALKYRA at I3');
    expect(text).toContain("**WAR ROOM DEMO · LONESTAR · ZESTAFONA · DEFAULT ZONE**");
    expect(text).toContain("Medical (URGENT) · by Rook · at F5");
    expect(text).toContain("claimed by Krieger (ETA 60 s)");
  });
  it("planToText handles an empty room and an uploaded map without metres", () => {
    const s = applyOps(makeState(), [
      op(
        {
          t: "settings.update",
          patch: {
            mapSource: {
              kind: "upload",
              hash: "a".repeat(64),
              w: 1024,
              h: 1024,
              mime: "image/jpeg",
              name: "x.jpg",
            },
          },
        },
        2,
        A,
      ),
      op({ t: "node.add", nodes: [measureNode] }, 3, A),
    ]);
    const text = planToText(s, "Custom", 1_000_000);
    expect(text).toContain("• none");
    expect(text).toContain("0.50 map");
    const builtin = planToText(
      applyOp(makeState(), op({ t: "node.add", nodes: [measureNode] }, 3, A)),
      "Zestafona",
      1_000_000,
    );
    expect(builtin).toContain("1,200 m");
  });
  it("formatters", () => {
    expect(formatPlanDate(Date.UTC(2026, 8, 11, 14, 32))).toBe("2026-09-11 14:32 UTC");
    expect(formatAge(5_000)).toBe("5 s");
    expect(formatAge(125_000)).toBe("2 min");
    expect(formatAge(3_900_000)).toBe("1 h 05 min");
    expect(formatAge(-5)).toBe("0 s");
  });
  it("planToSnapshot wraps the state", () => {
    const s = makeState();
    expect(planToSnapshot(s, 42)).toEqual({ v: 1, state: s, savedAt: 42 });
  });
  it("importPlan replace clears every layer then adds; merge skips live ids and re-mints tombstoned ones", () => {
    const target = applyOps(makeState(), [
      op({ t: "node.add", nodes: [marker("M1"), stroke("S1", { layer: "squad:Alpha" })] }, 2, A),
      op({ t: "node.remove", ids: ["S1"] }, 3, A),
    ]);
    expect(layersOf(target)).toEqual(["team"]);
    const plan = planToSnapshot(
      applyOps(makeState(), [
        op(
          { t: "node.add", nodes: [marker("M1", { label: "OTHER" }), stroke("S1"), marker("M2")] },
          2,
          B,
        ),
      ]),
      10,
    );
    const merge = importPlan(target, plan, "merge", A, 99);
    expect(merge.length).toBe(1);
    if (merge[0].t === "node.add") {
      const ids = merge[0].nodes.map((n) => n.id);
      expect(ids).toContain("M2");
      expect(ids).not.toContain("M1");
      expect(ids).not.toContain("S1");
      const reminted = merge[0].nodes.find((n) => n.t === "stroke")!;
      expect(reminted.id).toMatch(/^[A-HJ-NP-Z2-9]{16}$/);
      expect(reminted.createdAt).toBe(99);
    }
    const replace = importPlan(target, plan, "replace", A, 99);
    expect(replace[0]).toEqual({ t: "layer.clear", layer: "team", types: null });
    const add = replace[1];
    expect(add.t).toBe("node.add");
    if (add.t === "node.add") {
      expect(add.nodes.length).toBe(3);
      expect(add.nodes.find((n) => n.t === "marker" && n.label === "OTHER")!.id).not.toBe("M1");
      expect(add.nodes.map((n) => n.id)).toContain("M2");
    }
    const applied = applyOps(
      target,
      replace.map((b, i) => op(b, 10 + i, A)),
    );
    expect(Object.keys(applied.nodes).length).toBe(3);
  });
  it("importPlan batches at MAX_NODES_PER_OP", () => {
    const nodes = Array.from({ length: MAX_NODES_PER_OP + 1 }, (_, i) => marker(`M${i}`));
    const plan = planToSnapshot(
      { ...makeState(), nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) },
      1,
    );
    const ops = importPlan(makeState(), plan, "merge", A, 1);
    expect(ops.length).toBe(2);
  });
});
