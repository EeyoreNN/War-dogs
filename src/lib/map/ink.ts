// Freehand ink helpers (§3.4). The only importer of perfect-freehand (§7.3).
import { getStroke } from "perfect-freehand";
import type { Point } from "../geo";
import { MAX_STROKE_POINTS } from "./types";

export const SIMPLIFY_TOLERANCE = 0.0008;

/** perfect-freehand outline polygon for `points` (any unit) at `widthPx` size. */
export function strokeOutline(points: Point[], widthPx: number): number[][] {
  if (points.length === 0) return [];
  return getStroke(
    points.map((p) => ({ x: p.x, y: p.y })),
    {
      size: widthPx,
      thinning: 0.55,
      smoothing: 0.6,
      streamline: 0.5,
      simulatePressure: true,
      last: true,
    },
  );
}

const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

/** "M … Q … Z" using quadratic midpoints between outline vertices. */
export function outlineToPath(outline: number[][]): string {
  if (outline.length === 0) return "";
  if (outline.length === 1) {
    const [x, y] = outline[0];
    return `M ${fmt(x)} ${fmt(y)} Z`;
  }
  const parts: string[] = [`M ${fmt(outline[0][0])} ${fmt(outline[0][1])} Q`];
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    parts.push(`${fmt(x0)} ${fmt(y0)} ${fmt((x0 + x1) / 2)} ${fmt((y0 + y1) / 2)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdp(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.slice();
  // Iterative stack to avoid recursion depth on long strokes.
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularDistance(points[i], points[s], points[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolerance && idx > 0) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Ramer–Douglas–Peucker, keeping the endpoints; hard-capped to MAX_STROKE_POINTS by decimation. */
export function simplify(points: Point[], tolerance = SIMPLIFY_TOLERANCE): Point[] {
  let out = rdp(points, tolerance);
  if (out.length > MAX_STROKE_POINTS) {
    const step = out.length / MAX_STROKE_POINTS;
    const dec: Point[] = [];
    for (let i = 0; i < MAX_STROKE_POINTS - 1; i++) dec.push(out[Math.floor(i * step)]);
    dec.push(out[out.length - 1]);
    out = dec;
  }
  return out;
}
