import { describe, expect, it } from "vitest";
import {
  add,
  bearingDeg,
  clamp01,
  clampPoint,
  distance,
  lerp,
  pointsEqual,
  pt,
  scale,
  snapAngle,
  sub,
} from "./geo";

describe("geo", () => {
  it("bearing: north 0, east 90, south 180, west 270", () => {
    const o = pt(0.5, 0.5);
    expect(bearingDeg(o, pt(0.5, 0.1))).toBeCloseTo(0);
    expect(bearingDeg(o, pt(0.9, 0.5))).toBeCloseTo(90);
    expect(bearingDeg(o, pt(0.5, 0.9))).toBeCloseTo(180);
    expect(bearingDeg(o, pt(0.1, 0.5))).toBeCloseTo(270);
    expect(bearingDeg(o, pt(0.9, 0.1))).toBeCloseTo(45);
  });
  it("snapAngle keeps the length and snaps the direction", () => {
    const a = pt(0.5, 0.5);
    const b = pt(0.7, 0.48);
    const s = snapAngle(a, b, 15);
    expect(distance(a, s)).toBeCloseTo(distance(a, b));
    expect(bearingDeg(a, s) % 15).toBeCloseTo(0);
    expect(bearingDeg(a, s)).toBeCloseTo(90);
  });
  it("clamps into [0, 1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clampPoint(pt(-0.5, 1.5))).toEqual({ x: 0, y: 1 });
  });
  it("vector helpers", () => {
    expect(add(pt(1, 2), pt(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(pt(1, 2), pt(3, 4))).toEqual({ x: -2, y: -2 });
    expect(scale(pt(1, 2), 2)).toEqual({ x: 2, y: 4 });
    expect(lerp(pt(0, 0), pt(1, 1), 0.25)).toEqual({ x: 0.25, y: 0.25 });
    expect(distance(pt(0, 0), pt(3, 4))).toBe(5);
    expect(pointsEqual(pt(0.1, 0.2), pt(0.1 + 1e-12, 0.2))).toBe(true);
    expect(pointsEqual(pt(0.1, 0.2), pt(0.2, 0.2))).toBe(false);
  });
});
