import type { Point } from "../geo";
import { clamp01 } from "../geo";
import { catmullRom, nearestOnPolyline, pointInRing, sampleGrid, type Grid } from "./geometry";
import { valueNoise2D } from "./noise";
import type { Poi, PoiKind, Road, RoadKind, Settlement, TerrainSpec } from "./types";
import type { Rng } from "./features";

/** What a biome decides before the heightfield exists. */
export interface Layout {
  sea: number | null;
  /** Base height before rivers carve and flats level. */
  base: (x: number, y: number) => number;
  rivers: { path: Point[]; width: number; depth: number }[];
  /** Lakes: ring + the flat height under it. */
  lakes: { ring: Point[]; level: number }[];
  /** Areas levelled to their centre height (settlements, zones); `min` forces land. */
  flats: { at: Point; r: number; min?: number }[];
}

/** The generator's working state once the heightfield exists. */
export interface World {
  spec: TerrainSpec;
  rng: Rng;
  grid: Grid;
  sea: number | null;
  layout: Layout;
  rivers: Point[][];
  water: Point[][];
  roads: Road[];
  settlements: Settlement[];
  pois: Poi[];
  fields: Point[][];
  woods: Point[][];
  /** Woodland score (≥ 0 = trees) at res 128; fields avoid it. */
  woodsScore: Grid;
  /** Names still unassigned, in spec order. */
  names: string[];
}

export const heightAt = (w: World, p: Point): number => sampleGrid(w.grid, p.x, p.y);

export function isLand(w: World, p: Point): boolean {
  if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return false;
  if (w.sea !== null && heightAt(w, p) <= w.sea + 0.015) return false;
  for (const lake of w.layout.lakes) if (pointInRing(p, lake.ring)) return false;
  return true;
}

/** Slope magnitude (height units per map unit) from central differences. */
export function slopeAt(w: World, p: Point): number {
  const e = 1.5 / w.grid.res;
  const dx = heightAt(w, { x: p.x + e, y: p.y }) - heightAt(w, { x: p.x - e, y: p.y });
  const dy = heightAt(w, { x: p.x, y: p.y + e }) - heightAt(w, { x: p.x, y: p.y - e });
  return Math.hypot(dx, dy) / (2 * e);
}

/**
 * A smooth route through way-points: Catmull–Rom, then a low-frequency sideways wobble so long
 * links do not read as ruler lines. Points are clamped to the map.
 */
export function route(rng: Rng, waypoints: Point[], wobble = 0.008, per = 7): Point[] {
  const seed = Math.floor(rng() * 0xffffffff) >>> 0;
  const noise = valueNoise2D(seed);
  const pts = catmullRom(waypoints, per);
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const ends = Math.min(1, i / 4, (pts.length - 1 - i) / 4);
    const k = (noise(i * 0.35, 0.5) - 0.5) * 2 * wobble * ends;
    out.push({ x: clamp01(pts[i].x + nx * k), y: clamp01(pts[i].y + ny * k) });
  }
  return out;
}

/** Nearest point on any road of the given kinds to `p`. */
export function nearestRoadPoint(
  w: World,
  p: Point,
  kinds: RoadKind[] = ["main"],
): { point: Point; road: Road; seg: number } | null {
  let best: { point: Point; road: Road; seg: number; dist: number } | null = null;
  for (const road of w.roads) {
    if (!kinds.includes(road.kind)) continue;
    const n = nearestOnPolyline(p, road.path);
    if (!best || n.dist < best.dist) best = { point: n.point, road, seg: n.seg, dist: n.dist };
  }
  return best;
}

/** Add a road from the nearest main road to `to`, with one bend. */
export function connect(w: World, to: Point, kind: RoadKind = "main", wobble = 0.006): Road | null {
  const from = nearestRoadPoint(w, to, ["main"]);
  if (!from) return null;
  const mid = {
    x: (from.point.x + to.x) / 2 + (w.rng() - 0.5) * 0.03,
    y: (from.point.y + to.y) / 2 + (w.rng() - 0.5) * 0.03,
  };
  const road: Road = { kind, path: route(w.rng, [from.point, mid, to], wobble, 6) };
  w.roads.push(road);
  return road;
}

/** Pop the next unassigned place name. */
export function nextName(w: World): string {
  return w.names.shift() ?? "Unnamed";
}

export function addPoi(w: World, kind: PoiKind, at: Point, name = nextName(w)): Poi {
  const poi: Poi = {
    id: `poi-${w.pois.length + 1}`,
    name,
    kind,
    at: { x: clamp01(at.x), y: clamp01(at.y) },
  };
  w.pois.push(poi);
  return poi;
}

export function addSettlement(w: World, s: Omit<Settlement, "id">): Settlement {
  const settlement: Settlement = { id: `set-${w.settlements.length + 1}`, ...s };
  w.settlements.push(settlement);
  return settlement;
}

/** First point where a road path crosses a river polyline (bridge), or null. */
export function crossing(road: Point[], river: Point[]): Point | null {
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1];
    const b = road[i];
    for (let j = 1; j < river.length; j++) {
      const c = river[j - 1];
      const d = river[j];
      const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (Math.abs(den) < 1e-12) continue;
      const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
      const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return null;
}

/** Highest sample along a path, as a point. */
export function highestAlong(w: World, path: Point[]): Point {
  let best = path[0];
  let h = -1;
  for (const p of path) {
    const v = heightAt(w, p);
    if (v > h) {
      h = v;
      best = p;
    }
  }
  return best;
}

/** Highest cell of the grid interior (≥ 6 % from every edge), as a point. */
export function highestPoint(w: World): Point {
  const r = w.grid.res;
  const m = Math.round(r * 0.06);
  let best = 0;
  let idx = 0;
  for (let j = m; j < r - m; j++)
    for (let i = m; i < r - m; i++) {
      const v = w.grid.data[j * r + i];
      if (v > best) {
        best = v;
        idx = j * r + i;
      }
    }
  return { x: (idx % r) / (r - 1), y: Math.floor(idx / r) / (r - 1) };
}

/** Vertex of a polyline with the sharpest turn (a river bend). */
export function sharpestBend(path: Point[]): Point {
  let best = path[Math.floor(path.length / 2)];
  let score = -1;
  for (let i = 4; i < path.length - 4; i++) {
    const a = path[i - 4];
    const b = path[i];
    const c = path[i + 4];
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
    if (1 - cos > score) {
      score = 1 - cos;
      best = b;
    }
  }
  return best;
}

/** The point of a ring furthest along direction `dir` within an optional y band. */
export function extremePoint(ring: Point[], dir: Point, band?: [number, number]): Point {
  let best = ring[0];
  let score = -Infinity;
  for (const p of ring) {
    if (band && (p.y < band[0] || p.y > band[1])) continue;
    const s = p.x * dir.x + p.y * dir.y;
    if (s > score) {
      score = s;
      best = p;
    }
  }
  return best;
}
