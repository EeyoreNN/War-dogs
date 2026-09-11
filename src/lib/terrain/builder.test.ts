import { describe, expect, it } from "vitest";
import {
  crossing,
  extremePoint,
  highestAlong,
  highestPoint,
  isLand,
  nearestRoadPoint,
  route,
  sharpestBend,
  slopeAt,
  type World,
} from "./builder";
import { mulberry32 } from "./rng";

const res = 8;
const data = new Float32Array(res * res);
for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) data[j * res + i] = i / (res - 1);
const world = {
  grid: { data, res },
  sea: 0.2,
  layout: {
    lakes: [
      {
        ring: [
          { x: 0.6, y: 0.6 },
          { x: 0.7, y: 0.6 },
          { x: 0.7, y: 0.7 },
          { x: 0.6, y: 0.7 },
        ],
        level: 0.3,
      },
    ],
  },
  roads: [
    {
      kind: "main" as const,
      path: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ],
    },
  ],
} as unknown as World;

describe("builder helpers", () => {
  it("land, slope and highs", () => {
    expect(isLand(world, { x: 0.05, y: 0.5 })).toBe(false); // below sea
    expect(isLand(world, { x: 0.9, y: 0.5 })).toBe(true);
    expect(isLand(world, { x: 0.65, y: 0.65 })).toBe(false); // lake
    expect(isLand(world, { x: 1.2, y: 0.5 })).toBe(false);
    expect(slopeAt(world, { x: 0.5, y: 0.5 })).toBeCloseTo(1, 1);
    expect(highestPoint(world).x).toBeGreaterThan(0.9);
    expect(
      highestAlong(world, [
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ]),
    ).toEqual({ x: 0.8, y: 0.5 });
  });
  it("routes, crossings and bends", () => {
    const rng = mulberry32(2);
    const path = route(
      rng,
      [
        { x: 0, y: 0.5 },
        { x: 0.5, y: 0.4 },
        { x: 1, y: 0.5 },
      ],
      0.01,
    );
    expect(path[0]).toEqual({ x: 0, y: 0.5 });
    expect(path[path.length - 1]).toEqual({ x: 1, y: 0.5 });
    expect(path.length).toBeGreaterThan(10);
    expect(
      crossing(
        [
          { x: 0.5, y: 0 },
          { x: 0.5, y: 1 },
        ],
        [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
      ),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      crossing(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      ),
    ).toBeNull();
    const bend = sharpestBend([
      ...Array.from({ length: 10 }, (_, i) => ({ x: i / 10, y: 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 1, y: i / 10 })),
    ]);
    expect(bend.x).toBeGreaterThan(0.8);
    expect(nearestRoadPoint(world, { x: 0.3, y: 0.9 })?.point).toEqual({ x: 0.3, y: 0.5 });
    expect(nearestRoadPoint(world, { x: 0.3, y: 0.9 }, ["rail"])).toBeNull();
    expect(
      extremePoint(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0.5, y: 1 },
        ],
        { x: 1, y: 0 },
      ),
    ).toEqual({ x: 1, y: 0.5 });
    expect(
      extremePoint(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0.5, y: 1 },
        ],
        { x: 1, y: 0 },
        [0.9, 1],
      ),
    ).toEqual({ x: 0.5, y: 1 });
  });
});
