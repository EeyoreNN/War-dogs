import { describe, expect, it } from "vitest";
import { marker, shape, stroke, text as textNode } from "@/lib/map/test-fixtures";
import { handlePatch, movePatch, nodeBounds, nodeHandles, withPatch } from "./hit";

describe("hit geometry", () => {
  it("bounds for every node type", () => {
    const b = nodeBounds(marker("M", { kind: "danger", at: { x: 0.5, y: 0.5 }, radius: 0.05 }));
    expect(b).toEqual({ x0: 0.45, y0: 0.45, x1: 0.55, y1: 0.55 });
    const c = nodeBounds(
      shape("S", { shape: "circle", a: { x: 0.5, y: 0.5 }, b: { x: 0.6, y: 0.5 } }),
    );
    expect(c.x0).toBeCloseTo(0.4);
    const s = nodeBounds(
      stroke("K", {
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.1 },
        ],
      }),
    );
    expect(s).toEqual({ x0: 0.1, y0: 0.1, x1: 0.3, y1: 0.2 });
    const t = nodeBounds(textNode("T", { text: "Hi", at: { x: 0.2, y: 0.2 } }));
    expect(t.x1).toBeGreaterThan(t.x0);
  });
  it("move patches clamp to the map", () => {
    expect(movePatch(marker("M", { at: { x: 0.99, y: 0.5 } }), 0.05, 0)).toEqual({
      at: { x: 1, y: 0.5 },
    });
    const moved = movePatch(
      shape("S", { a: { x: 0.1, y: 0.1 }, b: { x: 0.2, y: 0.2 } }),
      0.01,
      0.01,
    );
    expect(moved.a!.x).toBeCloseTo(0.11);
    expect(moved.a!.y).toBeCloseTo(0.11);
    expect(moved.b!.x).toBeCloseTo(0.21);
    expect(moved.b!.y).toBeCloseTo(0.21);
    const st = stroke("K", {
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
      ],
    });
    expect(movePatch(st, -0.1, 0.1).points).toEqual([
      { x: 0, y: 0.1 },
      { x: 0.4, y: 0.6 },
    ]);
  });
  it("handles and their patches", () => {
    const d = marker("M", { kind: "danger", at: { x: 0.5, y: 0.5 }, radius: 0.04 });
    expect(nodeHandles(d)).toEqual([{ id: "radius", at: { x: 0.54, y: 0.5 } }]);
    expect(handlePatch(d, "radius", { x: 0.5, y: 0.6 })!.radius).toBeCloseTo(0.1);
    const arrow = shape("S", { shape: "arrow", a: { x: 0.1, y: 0.1 }, b: { x: 0.2, y: 0.2 } });
    expect(nodeHandles(arrow).map((h) => h.id)).toEqual(["a", "b"]);
    expect(handlePatch(arrow, "b", { x: 1.2, y: 0.3 })).toEqual({ b: { x: 1, y: 0.3 } });
    expect(handlePatch(marker("M", { kind: "pin" }), "a", { x: 0, y: 0 })).toBeNull();
    expect(nodeHandles(marker("M", { kind: "pin" }))).toEqual([]);
  });
  it("withPatch previews only valid keys", () => {
    const m = marker("M", { kind: "pin", at: { x: 0.1, y: 0.1 } });
    expect((withPatch(m, { at: { x: 0.2, y: 0.2 }, points: [] }) as typeof m).at).toEqual({
      x: 0.2,
      y: 0.2,
    });
    expect(withPatch(m, null)).toBe(m);
  });
});
