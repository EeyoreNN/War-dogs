import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";
import {
  blob,
  block,
  blocksAlongAxis,
  fieldParcels,
  int,
  maskRings,
  range,
  rectCenter,
  scatteredBlocks,
  tankBlocks,
  unit,
  yardBlocks,
  zonePolygon,
} from "./features";
import { pointInRing } from "./geometry";

const inMap = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

describe("features", () => {
  it("range/int/unit helpers", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 20; i++) {
      const v = range(rng, 2, 3);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(3);
      const n = int(rng, 1, 3);
      expect([1, 2, 3]).toContain(n);
    }
    expect(unit(0)).toEqual({ x: 1, y: 0 });
  });
  it("blob rings are closed, clamped and contain their centre", () => {
    const ring = blob(mulberry32(3), { x: 0.5, y: 0.5 }, 0.05);
    expect(ring.length).toBe(36);
    expect(ring.every(inMap)).toBe(true);
    expect(pointInRing({ x: 0.5, y: 0.5 }, ring)).toBe(true);
  });
  it("zone polygons have 12–20 vertices near the radius", () => {
    for (let seed = 0; seed < 10; seed++) {
      const z = zonePolygon(mulberry32(seed), seed % 2 ? "default" : "houses", { x: 0.5, y: 0.5 });
      expect(z.polygon.length).toBeGreaterThanOrEqual(12);
      expect(z.polygon.length).toBeLessThanOrEqual(20);
      expect(z.radius).toBe(seed % 2 ? 0.075 : 0.06);
      for (const p of z.polygon) {
        const d = Math.hypot(p.x - 0.5, p.y - 0.5);
        expect(d).toBeGreaterThan(z.radius * 0.85);
        expect(d).toBeLessThan(z.radius * 1.15);
      }
    }
    expect(zonePolygon(mulberry32(1), "default", { x: 0.01, y: 0.99 }).polygon.every(inMap)).toBe(
      true,
    );
  });
  it("places blocks", () => {
    const rng = mulberry32(9);
    const land = () => true;
    const b = block(rng, { x: 0.5, y: 0.5 }, 0.3, { w: [0.01, 0.02], h: [0.01, 0.02] });
    expect(rectCenter(b).x).toBeCloseTo(0.5);
    expect(b.rot).toBe(0.3);
    const street = blocksAlongAxis(rng, { x: 0.5, y: 0.5 }, 0, {
      w: [0.01, 0.02],
      h: [0.01, 0.02],
      perSide: 3,
      spacing: 0.02,
      offset: 0.012,
      keep: 1,
      skipFirst: true,
      onLand: land,
    });
    expect(street).toHaveLength(12);
    expect(
      blocksAlongAxis(rng, { x: 0.5, y: 0.5 }, 0, {
        w: [0.01, 0.02],
        h: [0.01, 0.02],
        perSide: 1,
        spacing: 0.02,
        offset: 0.01,
        keep: 1,
        onLand: () => false,
      }),
    ).toHaveLength(0);
    const village = scatteredBlocks(rng, { x: 0.5, y: 0.5 }, 0.03, 8, {
      w: [0.007, 0.011],
      h: [0.005, 0.008],
      onLand: land,
    });
    expect(village).toHaveLength(8);
    const yard = yardBlocks(rng, { x: 0.5, y: 0.5 }, 0.2, 5, {
      w: [0.03, 0.036],
      h: [0.02, 0.024],
      cols: 2,
      gap: 0.008,
      onLand: land,
    });
    expect(yard).toHaveLength(5);
    const tanks = tankBlocks(rng, { x: 0.5, y: 0.5 }, 1, 4, [0.013, 0.018]);
    expect(tanks).toHaveLength(4);
    expect(tanks.every((t) => t.w === t.h)).toBe(true);
  });
  it("field parcels are quads inside the map and the keep predicate", () => {
    const parcels = fieldParcels(mulberry32(5), { x: 0.5, y: 0.5 }, 0.1, (p) => p.x < 0.55);
    expect(parcels.length).toBeGreaterThan(3);
    for (const q of parcels) {
      expect(q).toHaveLength(4);
      expect(q.every((p) => inMap(p) && p.x < 0.56)).toBe(true);
    }
  });
  it("maskRings drops slivers", () => {
    const res = 16;
    const data = new Float32Array(res * res).fill(-1);
    for (let j = 4; j < 12; j++) for (let i = 4; i < 12; i++) data[j * res + i] = 1;
    data[0] = 1; // a single-cell sliver
    const rings = maskRings({ data, res }, 0.001, 0.001);
    expect(rings).toHaveLength(1);
  });
});
