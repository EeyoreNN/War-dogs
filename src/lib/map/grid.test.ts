import { describe, expect, it } from "vitest";
import { gridCell, gridCentre, gridLines, gridRef } from "./grid";

describe("grid", () => {
  it("corners and cells", () => {
    expect(gridRef({ x: 0, y: 0 })).toBe("A1");
    expect(gridRef({ x: 0.999, y: 0.999 })).toBe("J10");
    expect(gridRef({ x: 1, y: 1 })).toBe("J10");
    expect(gridRef({ x: 0.35, y: 0.62 })).toBe("D7");
    expect(gridRef({ x: -1, y: 2 })).toBe("A10");
  });
  it("keypad sub-cells: 7 8 9 top, 4 5 6 middle, 1 2 3 bottom", () => {
    const cell = (sx: number, sy: number) =>
      gridRef({ x: 0.3 + sx / 30 + 0.005, y: 0.6 + sy / 30 + 0.005 }, true);
    expect(cell(0, 0)).toBe("D7-7");
    expect(cell(1, 0)).toBe("D7-8");
    expect(cell(2, 0)).toBe("D7-9");
    expect(cell(0, 1)).toBe("D7-4");
    expect(cell(1, 1)).toBe("D7-5");
    expect(cell(2, 1)).toBe("D7-6");
    expect(cell(0, 2)).toBe("D7-1");
    expect(cell(1, 2)).toBe("D7-2");
    expect(cell(2, 2)).toBe("D7-3");
  });
  it("gridCell is the inverse of gridRef", () => {
    const c = gridCell("D7")!;
    expect(c.x0).toBeCloseTo(0.3);
    expect(c.y0).toBeCloseTo(0.6);
    expect(c.x1).toBeCloseTo(0.4);
    expect(c.y1).toBeCloseTo(0.7);
    const sub = gridCell("d7-1")!;
    expect(sub.x0).toBeCloseTo(0.3);
    expect(sub.y0).toBeCloseTo(0.6 + 2 / 30);
    expect(gridRef({ x: (sub.x0 + sub.x1) / 2, y: (sub.y0 + sub.y1) / 2 }, true)).toBe("D7-1");
    for (let d = 1; d <= 9; d++) {
      const centre = gridCentre(`F3-${d}`)!;
      expect(gridRef(centre, true)).toBe(`F3-${d}`);
    }
    expect(gridCell("J10")!.x1).toBeCloseTo(1);
    expect(gridCell("K1")).toBeNull();
    expect(gridCell("A0")).toBeNull();
    expect(gridCell("A11")).toBeNull();
    expect(gridCell("A1-0")).toBeNull();
    expect(gridCentre("zz")).toBeNull();
  });
  it("gridLines has 11 values per axis", () => {
    const g = gridLines();
    expect(g.cols.length).toBe(11);
    expect(g.rows.length).toBe(11);
    expect(g.cols[0]).toBe(0);
    expect(g.cols[10]).toBe(1);
  });
});
