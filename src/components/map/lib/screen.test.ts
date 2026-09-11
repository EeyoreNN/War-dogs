import { describe, expect, it } from "vitest";
import { MAP_PX } from "@/lib/map/types";
import { fitToBox } from "@/lib/map/viewport";
import {
  centreOn,
  coverBox,
  isVisible,
  screenTransform,
  terrainBucket,
  terrainCanvasTransform,
  viewportCentre,
  worldMatrix,
} from "./screen";

describe("screen plumbing", () => {
  it("world matrix and screen-constant transform", () => {
    expect(worldMatrix({ scale: 0.5, tx: 10, ty: 20 })).toBe("matrix(0.5 0 0 0.5 10 20)");
    expect(screenTransform({ x: 0.5, y: 0.25 })).toBe(
      `translate(${(0.5 * MAP_PX).toFixed(2)}px, ${(0.25 * MAP_PX).toFixed(2)}px) scale(var(--inv))`,
    );
  });
  it("terrain buckets follow the on-screen size", () => {
    expect(terrainBucket(0.2)).toBe(512);
    expect(terrainBucket(0.49)).toBe(1024);
    expect(terrainBucket(0.49, 2)).toBe(2048);
    expect(terrainBucket(4)).toBe(2048);
  });
  it("terrain canvas transform matches the world matrix", () => {
    expect(terrainCanvasTransform({ scale: 0.5, tx: 10, ty: 20 }, 1024)).toBe(
      "translate(10px, 20px) scale(1)",
    );
  });
  it("centre maths round-trips", () => {
    const box = { w: 1000, h: 800 };
    const v = fitToBox(box);
    const c = viewportCentre(v, box);
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
    const moved = centreOn(v, { x: 0.2, y: 0.9 }, box);
    const c2 = viewportCentre(moved, box);
    expect(c2.x).toBeCloseTo(0.2);
    expect(c2.y).toBeCloseTo(0.9);
    expect(isVisible(v, { x: 0.5, y: 0.5 }, box)).toBe(true);
    expect(isVisible(moved, { x: 0.9, y: 0.1 }, box)).toBe(false);
  });
  it("cover fills the larger side", () => {
    const v = coverBox({ w: 1600, h: 1000 });
    expect(v.scale * MAP_PX).toBe(1600);
    expect(v.tx).toBe(0);
    expect(v.ty).toBe(-300);
  });
});
