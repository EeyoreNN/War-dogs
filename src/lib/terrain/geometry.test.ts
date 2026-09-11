import { describe, expect, it } from "vitest";
import {
  catmullRom,
  chaikinClosed,
  distToPolyline,
  distToSegmentSq,
  downsample,
  isolines,
  isolinesPadded,
  nearestOnPolyline,
  padGrid,
  pointAlong,
  pointInRing,
  polylineLength,
  ringArea,
  ringCentroid,
  sampleGrid,
  simplify,
  type Grid,
} from "./geometry";

const square = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
];

describe("distances", () => {
  it("measure to segments and polylines", () => {
    expect(distToSegmentSq({ x: 0.5, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(1);
    expect(distToSegmentSq({ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(1);
    expect(distToPolyline({ x: 0.5, y: 0.5 }, square)).toBeCloseTo(0.3);
    const n = nearestOnPolyline({ x: 0.5, y: 0 }, square);
    expect(n.seg).toBe(0);
    expect(n.point).toEqual({ x: 0.5, y: 0.2 });
    expect(n.dist).toBeCloseTo(0.2);
  });
  it("walks along a polyline", () => {
    expect(polylineLength(square)).toBeCloseTo(1.8);
    const mid = pointAlong(square, 0.5);
    expect(mid.point.y).toBeCloseTo(0.5);
    expect(mid.tangent).toEqual({ x: 0, y: 1 });
    expect(pointAlong(square, 0).point).toEqual(square[0]);
    expect(pointAlong(square, 1).point.x).toBeCloseTo(square[3].x);
    expect(pointAlong(square, 1).point.y).toBeCloseTo(square[3].y);
  });
});

describe("simplify", () => {
  it("drops collinear points and keeps corners", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.0001 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(simplify(line, 0.01)).toEqual([line[0], line[2], line[3]]);
    expect(simplify(line, 0)).toHaveLength(4);
    expect(simplify(square.concat({ x: 0.2, y: 0.5 }), 0.01, true)).toHaveLength(4);
    expect(simplify([{ x: 0, y: 0 }], 0.1)).toHaveLength(1);
  });
});

describe("rings", () => {
  it("area, centroid and containment", () => {
    expect(Math.abs(ringArea(square))).toBeCloseTo(0.36);
    expect(ringCentroid(square).x).toBeCloseTo(0.5);
    expect(ringCentroid(square).y).toBeCloseTo(0.5);
    expect(
      ringCentroid([
        { x: 1, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toEqual({ x: 1, y: 1 });
    expect(pointInRing({ x: 0.5, y: 0.5 }, square)).toBe(true);
    expect(pointInRing({ x: 0.9, y: 0.5 }, square)).toBe(false);
    expect(chaikinClosed(square)).toHaveLength(8);
  });
});

describe("catmullRom", () => {
  it("passes through every control point", () => {
    const ctrl = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.3 },
      { x: 1, y: 0 },
    ];
    const pts = catmullRom(ctrl, 4);
    expect(pts[0]).toEqual(ctrl[0]);
    expect(pts[4]).toEqual(ctrl[1]);
    expect(pts[pts.length - 1]).toEqual(ctrl[2]);
    expect(catmullRom([ctrl[0]])).toEqual([ctrl[0]]);
  });
});

describe("grids", () => {
  const grid: Grid = { data: new Float32Array([0, 1, 0, 1]), res: 2 };
  it("samples bilinearly and downsamples by box average", () => {
    expect(sampleGrid(grid, 0, 0)).toBe(0);
    expect(sampleGrid(grid, 1, 0)).toBe(1);
    expect(sampleGrid(grid, 0.5, 0.5)).toBeCloseTo(0.5);
    const big: Grid = { data: new Float32Array(16).fill(0.25), res: 4 };
    const small = downsample(big, 2);
    expect(small.res).toBe(2);
    expect(Array.from(small.data)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(downsample(small, 4)).toBe(small);
  });
  it("extracts closed isolines that fill the area above the level", () => {
    const res = 16;
    const data = new Float32Array(res * res);
    for (let j = 0; j < res; j++)
      for (let i = 0; i < res; i++) {
        const d = Math.hypot(i / (res - 1) - 0.5, j / (res - 1) - 0.5);
        data[j * res + i] = d < 0.25 ? 1 : 0;
      }
    const rings = isolines({ data, res }, 0.5, -1);
    expect(rings).toHaveLength(1);
    const ring = rings[0];
    expect(ring.length).toBeGreaterThan(8);
    expect(pointInRing({ x: 0.5, y: 0.5 }, ring)).toBe(true);
    expect(pointInRing({ x: 0.05, y: 0.05 }, ring)).toBe(false);
    expect(Math.abs(ringArea(ring))).toBeCloseTo(Math.PI * 0.25 * 0.25, 1);
    // A plateau touching the edge closes along the edge (pad is below the level).
    const pad = padGrid({ data: new Float32Array(res * res).fill(1), res }, -1);
    const edge = isolinesPadded(pad, res, 0.5);
    expect(edge).toHaveLength(1);
    expect(Math.abs(ringArea(edge[0]))).toBeCloseTo(1, 1);
    for (const p of edge[0]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
    }
    // Nothing above the level → no rings; saddles resolve without throwing.
    expect(isolines({ data: new Float32Array(res * res), res }, 0.5, -1)).toHaveLength(0);
    const saddle = new Float32Array([1, 0, 0, 1]);
    expect(isolines({ data: saddle, res: 2 }, 0.5, -1).length).toBeGreaterThan(0);
  });
});
