import { describe, expect, it } from "vitest";
import { bearingDeg, distance } from "../geo";
import { markerAt, measureMetres, startTool, type Sample, type ToolContext } from "./tools";
import { A } from "./test-fixtures";
import type { Tool } from "./types";

const ctx = (tool: Tool, over: Partial<ToolContext> = {}): ToolContext => {
  let n = 0;
  return {
    tool,
    ink: "red",
    markerKind: "fob",
    enemyTeam: "Valkyra",
    layer: "team",
    author: A,
    authorName: "Alpha",
    widthMetres: 2400,
    now: () => 5_000,
    id: () => `ID${String(++n).padStart(14, "2")}`,
    ...over,
  };
};
const s = (x: number, y: number, over: Partial<Sample> = {}): Sample => ({
  p: { x, y },
  t: 0,
  pressure: 0.5,
  shift: false,
  alt: false,
  ...over,
});

describe("tools", () => {
  it("pen: down/move/up → one node.add with ≥ 2 points; a tap is a 2-point dot", () => {
    let sess = startTool(ctx("pen"));
    expect(sess.preview.t).toBe("none");
    sess = sess.down(s(0.1, 0.1));
    for (let i = 1; i <= 20; i++)
      sess = sess.move(s(0.1 + i * 0.01, 0.1 + i * 0.01 * (i % 2 ? 1 : 0.9)));
    expect(sess.preview.t).toBe("stroke");
    const { op, commit, session } = sess.up(s(0.32, 0.31));
    expect(op?.t).toBe("node.add");
    expect(commit?.t).toBe("stroke");
    if (commit?.t === "stroke") {
      expect(commit.points.length).toBeGreaterThanOrEqual(2);
      expect(commit.points[0]).toEqual({ x: 0.1, y: 0.1 });
      expect(commit.color).toBe("red");
      expect(commit.createdAt).toBe(5_000);
    }
    expect(session.preview.t).toBe("none");
    const tap = startTool(ctx("pen")).down(s(0.5, 0.5)).up(s(0.5, 0.5));
    expect(tap.commit?.t).toBe("stroke");
    if (tap.commit?.t === "stroke")
      expect(tap.commit.points).toEqual([
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.5 },
      ]);
    expect(startTool(ctx("pen")).down(s(0.5, 0.5)).cancel().preview.t).toBe("none");
  });
  it("shapes below 0.004 give no op; longer ones commit with a and b", () => {
    for (const tool of ["arrow", "line", "circle", "rect"] as const) {
      const none = startTool(ctx(tool)).down(s(0.5, 0.5)).move(s(0.502, 0.5)).up(s(0.502, 0.5));
      expect(none.op).toBeNull();
      const r = startTool(ctx(tool)).down(s(0.5, 0.5)).move(s(0.6, 0.6)).up(s(0.6, 0.6));
      expect(r.commit?.t).toBe("shape");
      if (r.commit?.t === "shape") {
        expect(r.commit.shape).toBe(tool);
        expect(r.commit.a).toEqual({ x: 0.5, y: 0.5 });
        expect(r.commit.b).toEqual({ x: 0.6, y: 0.6 });
      }
    }
  });
  it("shift snaps lines and arrows to 15° and constrains rects to squares", () => {
    const sess = startTool(ctx("arrow"))
      .down(s(0.5, 0.5))
      .move(s(0.7, 0.48, { shift: true }));
    expect(sess.preview.t).toBe("shape");
    if (sess.preview.t === "shape") {
      expect(bearingDeg(sess.preview.a, sess.preview.b)).toBeCloseTo(90);
      expect(distance(sess.preview.a, sess.preview.b)).toBeCloseTo(
        distance({ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.48 }),
      );
    }
    const rect = startTool(ctx("rect"))
      .down(s(0.2, 0.2))
      .up(s(0.5, 0.3, { shift: true }));
    if (rect.commit?.t === "shape") expect(rect.commit.b).toEqual({ x: 0.5, y: 0.5 });
    const circle = startTool(ctx("circle"))
      .down(s(0.5, 0.5))
      .up(s(0.6, 0.51, { shift: true }));
    if (circle.commit?.t === "shape")
      expect(bearingDeg(circle.commit.a, circle.commit.b)).toBeCloseTo(90);
  });
  it("measure previews metres = widthMetres × distance and commits a Measurement", () => {
    const sess = startTool(ctx("measure")).down(s(0.1, 0.5)).move(s(0.6, 0.5));
    expect(sess.preview.t).toBe("measure");
    if (sess.preview.t === "measure") {
      expect(sess.preview.metres).toBeCloseTo(1200);
      expect(sess.preview.bearing).toBeCloseTo(90);
    }
    const r = sess.up(s(0.6, 0.5));
    expect(r.commit?.t).toBe("measure");
    const none = startTool(ctx("measure", { widthMetres: null }))
      .down(s(0.1, 0.5))
      .move(s(0.6, 0.5));
    if (none.preview.t === "measure") expect(none.preview.metres).toBeNull();
    expect(measureMetres({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 2000)).toBe(1000);
    expect(measureMetres({ x: 0, y: 0 }, { x: 0.5, y: 0 }, null)).toBeNull();
  });
  it("marker commits at the tap point with the default label; enemy kinds carry the faction", () => {
    const r = startTool(ctx("marker")).down(s(0.3, 0.4)).move(s(0.9, 0.9)).up(s(0.9, 0.9));
    expect(r.commit?.t).toBe("marker");
    if (r.commit?.t === "marker") {
      expect(r.commit.at).toEqual({ x: 0.3, y: 0.4 });
      expect(r.commit.label).toBe("FOB");
      expect(r.commit.team).toBeNull();
      expect(r.commit.radius).toBeNull();
    }
    const enemy = markerAt(ctx("marker", { markerKind: "enemy-troops" }), { x: 1.4, y: -1 });
    expect(enemy.team).toBe("Valkyra");
    expect(enemy.at).toEqual({ x: 1, y: 0 });
    const danger = markerAt(ctx("marker", { markerKind: "danger" }), { x: 0.5, y: 0.5 });
    expect(danger.radius).toBe(0.04);
    expect(danger.label).toBe("DANGER");
  });
  it("text, request, ping and select are inert here", () => {
    for (const tool of ["text", "request", "ping", "select"] as const) {
      const r = startTool(ctx(tool)).down(s(0.3, 0.4)).move(s(0.5, 0.5)).up(s(0.5, 0.5));
      expect(r.op).toBeNull();
      expect(r.session.preview.t).toBe("none");
    }
  });
});
