// Node geometry for selection handles and keyboard nudging (§4.3.3). Map units throughout.
import { clamp01 } from "@/lib/geo";
import type { MapNode, NodePatch, Point } from "@/lib/map/types";
import { TEXT_SIZE_PX } from "./palette";
import { MAP_PX } from "@/lib/map/types";

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Axis-aligned bounds of a node in map units (markers and text get a nominal box). */
export function nodeBounds(n: MapNode): Bounds {
  switch (n.t) {
    case "marker": {
      const r = n.kind === "danger" && n.radius !== null ? n.radius : 0.012;
      return { x0: n.at.x - r, y0: n.at.y - r, x1: n.at.x + r, y1: n.at.y + r };
    }
    case "text": {
      const lines = n.text.split("\n");
      const size = TEXT_SIZE_PX[n.size] / MAP_PX;
      const w = Math.max(...lines.map((l) => l.length)) * size * 0.6;
      const h = lines.length * size * 1.2;
      return { x0: n.at.x, y0: n.at.y - size, x1: n.at.x + w, y1: n.at.y - size + h };
    }
    case "shape":
      if (n.shape === "circle") {
        const r = Math.hypot(n.b.x - n.a.x, n.b.y - n.a.y);
        return { x0: n.a.x - r, y0: n.a.y - r, x1: n.a.x + r, y1: n.a.y + r };
      }
      return box([n.a, n.b]);
    case "measure":
      return box([n.a, n.b]);
    case "stroke":
      return box(n.points);
  }
}

function box(points: Point[]): Bounds {
  let x0 = 1,
    y0 = 1,
    x1 = 0,
    y1 = 0;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** The patch that moves a node by (dx, dy) map units, clamped to the map. */
export function movePatch(n: MapNode, dx: number, dy: number): NodePatch {
  const mv = (p: Point): Point => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) });
  switch (n.t) {
    case "marker":
    case "text":
      return { at: mv(n.at) };
    case "shape":
    case "measure":
      return { a: mv(n.a), b: mv(n.b) };
    case "stroke":
      return { points: n.points.map(mv) };
  }
}

/** Apply a patch to a node for previews (only keys valid for the type). */
export function withPatch(n: MapNode, patch: NodePatch | null | undefined): MapNode {
  if (!patch) return n;
  switch (n.t) {
    case "marker":
      return {
        ...n,
        ...(patch.at ? { at: patch.at } : {}),
        ...(patch.radius !== undefined ? { radius: patch.radius } : {}),
        ...(patch.label !== undefined ? { label: patch.label } : {}),
      };
    case "text":
      return {
        ...n,
        ...(patch.at ? { at: patch.at } : {}),
        ...(patch.text !== undefined ? { text: patch.text } : {}),
      };
    case "shape":
    case "measure":
      return { ...n, ...(patch.a ? { a: patch.a } : {}), ...(patch.b ? { b: patch.b } : {}) };
    case "stroke":
      return { ...n, ...(patch.points ? { points: patch.points } : {}) };
  }
}

/** Handles a selected node exposes: shape/measure endpoints and the danger radius. */
export type HandleId = "a" | "b" | "radius";

export function nodeHandles(n: MapNode): { id: HandleId; at: Point }[] {
  switch (n.t) {
    case "shape":
    case "measure":
      return [
        { id: "a", at: n.a },
        { id: "b", at: n.b },
      ];
    case "marker":
      return n.kind === "danger" && n.radius !== null
        ? [{ id: "radius", at: { x: clamp01(n.at.x + n.radius), y: n.at.y } }]
        : [];
    default:
      return [];
  }
}

/** The patch for dragging a handle to `p`. */
export function handlePatch(n: MapNode, id: HandleId, p: Point): NodePatch | null {
  const q = { x: clamp01(p.x), y: clamp01(p.y) };
  if (id === "a" && (n.t === "shape" || n.t === "measure")) return { a: q };
  if (id === "b" && (n.t === "shape" || n.t === "measure")) return { b: q };
  if (id === "radius" && n.t === "marker")
    return { radius: Math.max(0.005, Math.min(0.4, Math.hypot(q.x - n.at.x, q.y - n.at.y))) };
  return null;
}
