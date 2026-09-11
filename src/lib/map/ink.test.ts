import { describe, expect, it } from "vitest";
import { outlineToPath, simplify, strokeOutline } from "./ink";
import { MAX_STROKE_POINTS } from "./types";

describe("ink", () => {
  const pts = Array.from({ length: 12 }, (_, i) => ({
    x: 10 + i * 8,
    y: 20 + Math.sin(i / 2) * 6,
  }));
  it("outline is stable for a fixed input", () => {
    const a = strokeOutline(pts, 6);
    const b = strokeOutline(pts, 6);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(pts.length);
    expect(a).toMatchSnapshot();
    expect(strokeOutline([], 6)).toEqual([]);
  });
  it("outlineToPath emits M … Q … Z", () => {
    const d = outlineToPath(strokeOutline(pts, 6));
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d).toContain(" Q ");
    expect(outlineToPath([])).toBe("");
    expect(outlineToPath([[1, 2]])).toBe("M 1 2 Z");
  });
  it("simplify reduces points and keeps the endpoints", () => {
    const line = Array.from({ length: 200 }, (_, i) => ({ x: i / 200, y: 0.5 + (i % 2) * 0.0001 }));
    const out = simplify(line, 0.0008);
    expect(out.length).toBeLessThan(line.length);
    expect(out[0]).toEqual(line[0]);
    expect(out[out.length - 1]).toEqual(line[line.length - 1]);
    expect(simplify([{ x: 0, y: 0 }], 0.001)).toEqual([{ x: 0, y: 0 }]);
    const big = Array.from({ length: 6000 }, (_, i) => ({ x: i / 6000, y: (i % 7) / 50 }));
    const capped = simplify(big, 0);
    expect(capped.length).toBe(MAX_STROKE_POINTS);
    expect(capped[0]).toEqual(big[0]);
    expect(capped[capped.length - 1]).toEqual(big[big.length - 1]);
  });
});
