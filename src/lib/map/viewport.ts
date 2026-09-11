// World ↔ screen maths (§3.4). screenX = worldX * MAP_PX * scale + tx.
import type { Point } from "../geo";
import { MAP_PX, type Viewport } from "./types";

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;

export function worldToScreen(v: Viewport, p: Point): { x: number; y: number } {
  return { x: p.x * MAP_PX * v.scale + v.tx, y: p.y * MAP_PX * v.scale + v.ty };
}

export function screenToWorld(v: Viewport, s: { x: number; y: number }): Point {
  const k = MAP_PX * v.scale;
  return { x: (s.x - v.tx) / k, y: (s.y - v.ty) / k };
}

/** Multiply the scale by `factor` keeping the world point under `s` fixed on screen. */
export function zoomAt(
  v: Viewport,
  s: { x: number; y: number },
  factor: number,
  min = MIN_SCALE,
  max = MAX_SCALE,
): Viewport {
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  if (scale === v.scale) return v;
  const w = screenToWorld(v, s);
  return { scale, tx: s.x - w.x * MAP_PX * scale, ty: s.y - w.y * MAP_PX * scale };
}

/** Scale so the whole map fits inside the box (minus `pad` on every side), centred. */
export function fitToBox(box: { w: number; h: number }, pad = 0): Viewport {
  const w = Math.max(1, box.w - 2 * pad);
  const h = Math.max(1, box.h - 2 * pad);
  const scale = Math.min(w, h) / MAP_PX;
  const size = MAP_PX * scale;
  return { scale, tx: (box.w - size) / 2, ty: (box.h - size) / 2 };
}

/** Keep at least 25 % of the map (or of the box, when the map is larger) visible on each axis. */
export function clampViewport(v: Viewport, box: { w: number; h: number }): Viewport {
  const size = MAP_PX * v.scale;
  const minX = 0.25 * Math.min(size, box.w);
  const minY = 0.25 * Math.min(size, box.h);
  const tx = Math.min(box.w - minX, Math.max(minX - size, v.tx));
  const ty = Math.min(box.h - minY, Math.max(minY - size, v.ty));
  return tx === v.tx && ty === v.ty ? v : { ...v, tx, ty };
}

export function panBy(v: Viewport, dx: number, dy: number): Viewport {
  return dx === 0 && dy === 0 ? v : { ...v, tx: v.tx + dx, ty: v.ty + dy };
}
