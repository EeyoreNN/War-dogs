import { describe, expect, it } from "vitest";
import { MAP_PX } from "./types";
import { clampViewport, fitToBox, panBy, screenToWorld, worldToScreen, zoomAt } from "./viewport";

describe("viewport", () => {
  it("world ↔ screen round-trips", () => {
    const v = { scale: 0.5, tx: 12, ty: -30 };
    const p = { x: 0.3, y: 0.7 };
    const s = worldToScreen(v, p);
    expect(s).toEqual({ x: 0.3 * MAP_PX * 0.5 + 12, y: 0.7 * MAP_PX * 0.5 - 30 });
    const back = screenToWorld(v, s);
    expect(back.x).toBeCloseTo(p.x);
    expect(back.y).toBeCloseTo(p.y);
  });
  it("zoomAt keeps the cursor point fixed and clamps to [min, max]", () => {
    const v = { scale: 1, tx: 0, ty: 0 };
    const cursor = { x: 400, y: 300 };
    const before = screenToWorld(v, cursor);
    const z = zoomAt(v, cursor, 2);
    expect(z.scale).toBe(2);
    const after = screenToWorld(z, cursor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(v, cursor, 100).scale).toBe(8);
    expect(zoomAt(v, cursor, 0.0001).scale).toBe(0.25);
    expect(zoomAt({ scale: 8, tx: 0, ty: 0 }, cursor, 2)).toEqual({ scale: 8, tx: 0, ty: 0 });
  });
  it("fitToBox centres the whole map", () => {
    const v = fitToBox({ w: 1000, h: 600 }, 20);
    expect(v.scale).toBeCloseTo(560 / MAP_PX);
    expect(worldToScreen(v, { x: 0.5, y: 0.5 })).toEqual({ x: 500, y: 300 });
    expect(worldToScreen(v, { x: 0, y: 0 }).y).toBeCloseTo(20);
  });
  it("clampViewport keeps at least 25 % visible", () => {
    const box = { w: 800, h: 600 };
    const v = { scale: 0.25, tx: 5000, ty: -5000 }; // map is 512 px
    const c = clampViewport(v, box);
    expect(c.tx).toBe(800 - 128);
    expect(c.ty).toBe(128 - 512);
    const big = clampViewport({ scale: 4, tx: -99999, ty: 99999 }, box); // map is 8192 px
    expect(big.tx).toBe(200 - 8192);
    expect(big.ty).toBe(600 - 150);
    const fine = { scale: 1, tx: 10, ty: 10 };
    expect(clampViewport(fine, box)).toBe(fine);
  });
  it("panBy", () => {
    const v = { scale: 1, tx: 1, ty: 2 };
    expect(panBy(v, 3, 4)).toEqual({ scale: 1, tx: 4, ty: 6 });
    expect(panBy(v, 0, 0)).toBe(v);
  });
});
