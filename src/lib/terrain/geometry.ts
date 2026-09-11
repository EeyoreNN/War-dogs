import type { Point } from "../geo";

/** Squared distance from `p` to the segment a–b. */
export function distToSegmentSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = a.x + dx * t - p.x;
  const ey = a.y + dy * t - p.y;
  return ex * ex + ey * ey;
}

/** Distance from `p` to a polyline. */
export function distToPolyline(p: Point, path: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = distToSegmentSq(p, path[i - 1], path[i]);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Closest point on a polyline to `p`, with the index of the segment it lies on. */
export function nearestOnPolyline(
  p: Point,
  path: readonly Point[],
): { point: Point; seg: number; dist: number } {
  let best = Infinity;
  let seg = 0;
  let point = path[0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < best) {
      best = d;
      seg = i - 1;
      point = q;
    }
  }
  return { point, seg, dist: Math.sqrt(best) };
}

/** Total length of a polyline. */
export function polylineLength(path: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++)
    len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return len;
}

/** Point at fraction `t` ∈ [0, 1] of the polyline's length, and the unit tangent there. */
export function pointAlong(path: readonly Point[], t: number): { point: Point; tangent: Point } {
  const total = polylineLength(path);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= seg || i === path.length - 1) {
      const u = seg === 0 ? 0 : Math.min(1, target / seg);
      const tx = seg === 0 ? 1 : (b.x - a.x) / seg;
      const ty = seg === 0 ? 0 : (b.y - a.y) / seg;
      return {
        point: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
        tangent: { x: tx, y: ty },
      };
    }
    target -= seg;
  }
  return { point: path[path.length - 1], tangent: { x: 1, y: 0 } };
}

/** Ramer–Douglas–Peucker simplification. Closed rings keep their first vertex. */
export function simplify(points: readonly Point[], eps: number, closed = false): Point[] {
  if (points.length < 3) return points.slice();
  const pts = closed ? [...points, points[0]] : points.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const eps2 = eps * eps;
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distToSegmentSq(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > eps2) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  if (closed) out.pop();
  return out;
}

/** Signed area of a ring (positive = clockwise in screen space). */
export function ringArea(ring: readonly Point[]): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Even-odd point-in-ring test. */
export function pointInRing(p: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/** Centroid of a ring (area-weighted; falls back to the vertex mean for degenerate rings). */
export function ringCentroid(ring: readonly Point[]): Point {
  const a = ringArea(ring);
  if (Math.abs(a) < 1e-12) {
    let x = 0;
    let y = 0;
    for (const p of ring) {
      x += p.x;
      y += p.y;
    }
    return { x: x / ring.length, y: y / ring.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/**
 * Centripetal Catmull–Rom through `ctrl`, `per` samples per span. The curve passes through every
 * control point, which is what road and river way-points need.
 */
export function catmullRom(ctrl: readonly Point[], per = 8): Point[] {
  if (ctrl.length < 2) return ctrl.slice();
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out: Point[] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

/** One pass of Chaikin corner cutting on a closed ring. */
export function chaikinClosed(ring: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    out.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 });
    out.push({ x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
  }
  return out;
}

export interface Grid {
  /** Values, row-major, `res` per side. */
  data: Float32Array;
  res: number;
}

/** Bilinear sample of a grid at normalised (x, y) ∈ [0, 1]². */
export function sampleGrid(g: Grid, x: number, y: number): number {
  const n = g.res - 1;
  const fx = Math.min(Math.max(x, 0), 1) * n;
  const fy = Math.min(Math.max(y, 0), 1) * n;
  const x0 = Math.min(Math.floor(fx), n - 1);
  const y0 = Math.min(Math.floor(fy), n - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const d = g.data;
  const r = g.res;
  const a = d[y0 * r + x0];
  const b = d[y0 * r + x0 + 1];
  const c = d[(y0 + 1) * r + x0];
  const e = d[(y0 + 1) * r + x0 + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty;
}

/** Box-average downsample to `res` per side. */
export function downsample(g: Grid, res: number): Grid {
  if (res >= g.res) return g;
  const out = new Float32Array(res * res);
  const k = g.res / res;
  for (let j = 0; j < res; j++) {
    const y0 = Math.floor(j * k);
    const y1 = Math.max(y0 + 1, Math.floor((j + 1) * k));
    for (let i = 0; i < res; i++) {
      const x0 = Math.floor(i * k);
      const x1 = Math.max(x0 + 1, Math.floor((i + 1) * k));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          sum += g.data[y * g.res + x];
          n++;
        }
      out[j * res + i] = sum / n;
    }
  }
  return { data: out, res };
}

/**
 * Marching squares over a grid padded with `outside`, so every isoline is a closed ring (regions
 * that touch the map edge close along it). Rings are returned in normalised map space; with
 * `outside` below `level`, filling all rings with the even-odd rule paints exactly the area at
 * or above `level`.
 */
/** The grid with a one-cell border of `outside`; reuse it across levels via `isolinesPadded`. */
export function padGrid(g: Grid, outside: number): Float32Array {
  const r = g.res;
  const w = r + 2;
  const data = new Float32Array(w * w).fill(outside);
  for (let j = 0; j < r; j++) data.set(g.data.subarray(j * r, j * r + r), (j + 1) * w + 1);
  return data;
}

export function isolines(g: Grid, level: number, outside: number): Point[][] {
  return isolinesPadded(padGrid(g, outside), g.res, level);
}

/** `isolines` over a buffer from `padGrid` (res = the unpadded side). */
export function isolinesPadded(pad: Float32Array, res: number, level: number): Point[][] {
  const r = res;
  const w = r + 2;
  const n = r - 1;
  const at = (i: number, j: number): number => pad[j * w + i];
  // Segment list: pairs of edge ids. Edge id = (j*w+i)*2 (+1 for the vertical edge).
  const segA: number[] = [];
  const segB: number[] = [];
  const push = (a: number, b: number) => {
    segA.push(a);
    segB.push(b);
  };
  for (let j = 0; j < w - 1; j++) {
    const row0 = j * w;
    const row1 = row0 + w;
    for (let i = 0; i < w - 1; i++) {
      const tl = pad[row0 + i];
      const tr = pad[row0 + i + 1];
      const br = pad[row1 + i + 1];
      const bl = pad[row1 + i];
      let c = 0;
      if (tl >= level) c |= 8;
      if (tr >= level) c |= 4;
      if (br >= level) c |= 2;
      if (bl >= level) c |= 1;
      if (c === 0 || c === 15) continue;
      const top = (row0 + i) * 2;
      const right = (row0 + i + 1) * 2 + 1;
      const bottom = (row1 + i) * 2;
      const left = (row0 + i) * 2 + 1;
      switch (c) {
        case 1:
        case 14:
          push(left, bottom);
          break;
        case 2:
        case 13:
          push(bottom, right);
          break;
        case 3:
        case 12:
          push(left, right);
          break;
        case 4:
        case 11:
          push(top, right);
          break;
        case 6:
        case 9:
          push(top, bottom);
          break;
        case 7:
        case 8:
          push(top, left);
          break;
        case 5:
        case 10: {
          const centre = (tl + tr + br + bl) / 4 >= level;
          // 5: tr & bl inside; 10: tl & br inside.
          if ((c === 5) === centre) {
            push(top, right);
            push(left, bottom);
          } else {
            push(top, left);
            push(bottom, right);
          }
          break;
        }
      }
    }
  }
  // Interpolated position of an edge id.
  const pos = (edge: number): Point => {
    const vertical = edge & 1;
    const cell = edge >> 1;
    const i = cell % w;
    const j = (cell - i) / w;
    const a = at(i, j);
    const b = vertical ? at(i, j + 1) : at(i + 1, j);
    const t = a === b ? 0.5 : (level - a) / (b - a);
    const gx = vertical ? i : i + t;
    const gy = vertical ? j + t : j;
    // Grid index 1 maps to map coordinate 0; pad cells clamp to the edge.
    const x = Math.min(1, Math.max(0, (gx - 1) / n));
    const y = Math.min(1, Math.max(0, (gy - 1) / n));
    return { x, y };
  };
  // Adjacency: edge id → segment indices.
  const adj = new Map<number, number[]>();
  const link = (e: number, s: number) => {
    const list = adj.get(e);
    if (list) list.push(s);
    else adj.set(e, [s]);
  };
  for (let s = 0; s < segA.length; s++) {
    link(segA[s], s);
    link(segB[s], s);
  }
  const used = new Uint8Array(segA.length);
  const rings: Point[][] = [];
  for (let start = 0; start < segA.length; start++) {
    if (used[start]) continue;
    const ring: Point[] = [];
    let s = start;
    let edge = segA[start];
    while (s !== -1 && !used[s]) {
      used[s] = 1;
      ring.push(pos(edge));
      edge = segA[s] === edge ? segB[s] : segA[s];
      const next = adj.get(edge);
      s = -1;
      if (next) for (const cand of next) if (!used[cand]) s = cand;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}
