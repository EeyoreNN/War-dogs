import type { Point, Rect } from "../geo";
import { clamp01 } from "../geo";
import { chaikinClosed, isolines, ringArea, simplify, type Grid } from "./geometry";
import type { ControlZone, ZoneAnchorId } from "./types";
import { CONTROL_ZONE_LABEL } from "./types";

export type Rng = () => number;

/** Uniform in [a, b). */
export const range = (rng: Rng, a: number, b: number): number => a + (b - a) * rng();
/** Integer in [a, b]. */
export const int = (rng: Rng, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));
export const unit = (rot: number): Point => ({ x: Math.cos(rot), y: Math.sin(rot) });

/** A wobbly closed ring of `n` vertices around `c` with mean radius `r` (lakes, ponds). */
export function blob(rng: Rng, c: Point, r: number, n = 18, wobble = 0.35): Point[] {
  const phase = rng() * Math.PI * 2;
  const k1 = int(rng, 2, 3);
  const k2 = int(rng, 4, 6);
  const a1 = range(rng, 0.4, 1) * wobble;
  const a2 = range(rng, 0.2, 0.6) * wobble;
  const ring: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = r * (1 + a1 * Math.sin(k1 * t + phase) + a2 * Math.cos(k2 * t - phase));
    ring.push({ x: clamp01(c.x + Math.cos(t) * rr), y: clamp01(c.y + Math.sin(t) * rr) });
  }
  return chaikinClosed(ring);
}

/**
 * Control-zone polygon: 12–20 vertices, roughly circular, radius jittered ±12 % by two low
 * harmonics so the ring reads as a surveyed boundary, not a wobble.
 */
export function zonePolygon(rng: Rng, id: ZoneAnchorId, center: Point): ControlZone {
  const radius = id === "default" ? 0.075 : 0.06;
  const n = int(rng, 12, 20);
  const phase = rng() * Math.PI * 2;
  const k = int(rng, 2, 4);
  const polygon: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = radius * (1 + 0.08 * Math.sin(k * t + phase) + 0.04 * Math.cos((k + 3) * t));
    polygon.push({
      x: clamp01(center.x + Math.cos(t) * rr),
      y: clamp01(center.y + Math.sin(t) * rr),
    });
  }
  return { id, name: CONTROL_ZONE_LABEL[id], center, radius, polygon };
}

export interface BlockOptions {
  /** Block width/height ranges (map units). */
  w: [number, number];
  h: [number, number];
}

/** A rotated block centred at `c`. */
export function block(rng: Rng, c: Point, rot: number, o: BlockOptions): Rect {
  const w = range(rng, o.w[0], o.w[1]);
  const h = range(rng, o.h[0], o.h[1]);
  return { x: clamp01(c.x - w / 2), y: clamp01(c.y - h / 2), w, h, rot };
}

/** Rect centre (blocks are stored top-left + size, rotated about the centre). */
export const rectCenter = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Blocks on both sides of a straight axis through `c` with direction `rot`: `perSide` slots each
 * way, `keep` probability, kept blocks aligned to the axis. Used for town streets and quays.
 */
export function blocksAlongAxis(
  rng: Rng,
  c: Point,
  rot: number,
  o: BlockOptions & {
    perSide: number;
    spacing: number;
    offset: number;
    keep: number;
    skipFirst?: boolean;
    onLand: (p: Point) => boolean;
  },
): Rect[] {
  const d = unit(rot);
  const n = { x: -d.y, y: d.x };
  const out: Rect[] = [];
  for (let k = -o.perSide; k <= o.perSide; k++) {
    if (k === 0 && o.skipFirst) continue;
    for (const side of [-1, 1]) {
      if (rng() > o.keep) continue;
      const along = k * o.spacing + range(rng, -0.25, 0.25) * o.spacing;
      const off = side * (o.offset + range(rng, 0, 0.004));
      const p = { x: c.x + d.x * along + n.x * off, y: c.y + d.y * along + n.y * off };
      if (!o.onLand(p)) continue;
      out.push(block(rng, p, rot + range(rng, -0.05, 0.05), o));
    }
  }
  return out;
}

/** Scattered blocks around `c` within radius `r`, sharing a village axis ±0.35 rad. */
export function scatteredBlocks(
  rng: Rng,
  c: Point,
  r: number,
  count: number,
  o: BlockOptions & { onLand: (p: Point) => boolean },
): Rect[] {
  const axis = rng() * Math.PI;
  const out: Rect[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 6) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * r;
    const p = { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr };
    if (!o.onLand(p)) continue;
    if (out.some((b) => Math.hypot(rectCenter(b).x - p.x, rectCenter(b).y - p.y) < o.w[1] * 1.1))
      continue;
    out.push(block(rng, p, axis + range(rng, -0.35, 0.35), o));
  }
  return out;
}

/** A compact grid of large blocks (industrial yard) with a shared rotation. */
export function yardBlocks(
  rng: Rng,
  c: Point,
  rot: number,
  count: number,
  o: BlockOptions & { cols: number; gap: number; onLand: (p: Point) => boolean },
): Rect[] {
  const d = unit(rot);
  const n = { x: -d.y, y: d.x };
  const out: Rect[] = [];
  const rows = Math.ceil(count / o.cols);
  const cw = o.w[1] + o.gap;
  const ch = o.h[1] + o.gap;
  let placed = 0;
  for (let r = 0; r < rows && placed < count; r++) {
    for (let col = 0; col < o.cols && placed < count; col++) {
      const u = (col - (o.cols - 1) / 2) * cw;
      const v = (r - (rows - 1) / 2) * ch;
      const p = { x: c.x + d.x * u + n.x * v, y: c.y + d.y * u + n.y * v };
      if (!o.onLand(p)) continue;
      out.push(block(rng, p, rot, o));
      placed++;
    }
  }
  return out;
}

/** Circular tanks (stored as square blocks) in a gentle arc beside `c`. */
export function tankBlocks(
  rng: Rng,
  c: Point,
  rot: number,
  count: number,
  size: [number, number],
): Rect[] {
  const d = unit(rot);
  const out: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const s = range(rng, size[0], size[1]);
    const along = (i - (count - 1) / 2) * (size[1] + 0.006);
    const bow = Math.abs(i - (count - 1) / 2) * 0.004;
    const p = { x: c.x + d.x * along - d.y * bow, y: c.y + d.y * along + d.x * bow };
    out.push({ x: clamp01(p.x - s / 2), y: clamp01(p.y - s / 2), w: s, h: s, rot: 0 });
  }
  return out;
}

/** Field parcels: a rotated lattice of quads around `c`, thinned and filtered by `keep`. */
export function fieldParcels(
  rng: Rng,
  c: Point,
  radius: number,
  keep: (p: Point) => boolean,
): Point[][] {
  const rot = rng() * Math.PI;
  const d = unit(rot);
  const n = { x: -d.y, y: d.x };
  const out: Point[][] = [];
  const cw = range(rng, 0.028, 0.05);
  const ch = range(rng, 0.02, 0.034);
  const cols = Math.ceil(radius / cw);
  const rows = Math.ceil(radius / ch);
  for (let j = -rows; j <= rows; j++) {
    for (let i = -cols; i <= cols; i++) {
      if (rng() > 0.72) continue;
      const u0 = i * cw + range(rng, -0.15, 0.15) * cw;
      const v0 = j * ch + range(rng, -0.15, 0.15) * ch;
      const w = cw * range(rng, 0.8, 1.15);
      const h = ch * range(rng, 0.8, 1.15);
      const corners = [
        [u0, v0],
        [u0 + w, v0],
        [u0 + w, v0 + h],
        [u0, v0 + h],
      ].map(([u, v]) => ({ x: c.x + d.x * u + n.x * v, y: c.y + d.y * u + n.y * v }));
      if (Math.hypot(u0 + w / 2, v0 + h / 2) > radius) continue;
      if (!corners.every((p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99 && keep(p)))
        continue;
      // Inset slightly so neighbouring parcels read as separate fields.
      const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
      const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
      out.push(corners.map((p) => ({ x: cx + (p.x - cx) * 0.9, y: cy + (p.y - cy) * 0.9 })));
    }
  }
  return out;
}

/** Closed rings where `score` ≥ 0, simplified and with tiny slivers dropped. */
export function maskRings(score: Grid, eps: number, minArea: number): Point[][] {
  const rings: Point[][] = [];
  for (const ring of isolines(score, 0, -1)) {
    const path = simplify(ring, eps, true);
    if (path.length >= 4 && Math.abs(ringArea(path)) >= minArea) rings.push(path);
  }
  return rings;
}
