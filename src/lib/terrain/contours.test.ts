import { describe, expect, it } from "vitest";
import { CONTOUR_STEP, contourLevels, contourLines } from "./contours";

describe("contours", () => {
  it("lists levels above sea and marks every 5th as index", () => {
    expect(contourLevels(null)).toHaveLength(19);
    expect(contourLevels(0.3)[0]).toBeCloseTo(0.35);
    expect(CONTOUR_STEP).toBe(0.05);
  });
  it("extracts closed simplified rings per level", () => {
    const res = 32;
    const data = new Float32Array(res * res);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) data[j * res + i] = i / (res - 1);
    const lines = contourLines({ data, res }, null, 0.001);
    expect(lines.length).toBe(19);
    expect(lines.filter((c) => c.index).map((c) => c.level)).toEqual([0.25, 0.5, 0.75]);
    for (const c of lines) expect(c.path.length).toBeGreaterThanOrEqual(4);
  });
});
