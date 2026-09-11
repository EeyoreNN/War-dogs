/** Normalised map space: x, y in [0, 1], origin top-left, square map. */
export interface Point {
  x: number;
  y: number;
}
/** Axis-aligned box in map space; `rot` is radians about the centre (used by terrain blocks). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

export const pt = (x: number, y: number): Point => ({ x, y });
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clampPoint = (p: Point): Point => ({ x: clamp01(p.x), y: clamp01(p.y) });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
/** Compass bearing from a to b in degrees [0, 360), 0 = north (up), clockwise. */
export const bearingDeg = (a: Point, b: Point): number => {
  const deg = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return (deg + 360) % 360;
};
/** Snap the direction a→b to the nearest `stepDeg` multiple, preserving length. */
export const snapAngle = (a: Point, b: Point, stepDeg: number): Point => {
  const len = distance(a, b);
  const brg = Math.round(bearingDeg(a, b) / stepDeg) * stepDeg;
  const rad = (brg * Math.PI) / 180;
  return { x: a.x + Math.sin(rad) * len, y: a.y - Math.cos(rad) * len };
};
export const pointsEqual = (a: Point, b: Point, eps = 1e-9): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
