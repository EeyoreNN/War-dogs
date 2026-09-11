// World ↔ screen plumbing shared by the preview and the live surface (§4.3.2): the one world
// matrix, the `--inv` factor that keeps markers screen-constant, terrain resolution buckets.
import { MAP_PX, type Point, type Viewport } from "@/lib/map/types";

export const worldMatrix = (v: Viewport): string =>
  `matrix(${v.scale} 0 0 ${v.scale} ${v.tx} ${v.ty})`;

/** `--inv` = 1 / scale, written on the <svg> root together with the world matrix. */
export const inverseScale = (v: Viewport): number => 1 / v.scale;

/** Style for a screen-constant group anchored at a map point (inside the world group). */
export function screenTransform(at: Point): string {
  return `translate(${(at.x * MAP_PX).toFixed(2)}px, ${(at.y * MAP_PX).toFixed(2)}px) scale(var(--inv))`;
}

export const wx = (x: number): number => x * MAP_PX;
export const wy = (y: number): number => y * MAP_PX;

export const TERRAIN_BUCKETS = [512, 1024, 2048] as const;
export type TerrainBucket = (typeof TERRAIN_BUCKETS)[number];

/** Terrain raster size for the current zoom: the smallest bucket at or above the on-screen map size. */
export function terrainBucket(scale: number, dpr = 1): TerrainBucket {
  const px = MAP_PX * scale * Math.max(1, Math.min(2, dpr));
  for (const b of TERRAIN_BUCKETS) if (px <= b) return b;
  return TERRAIN_BUCKETS[TERRAIN_BUCKETS.length - 1];
}

/** CSS transform for the terrain canvas (drawn at `bucket` px) so it follows the world matrix. */
export function terrainCanvasTransform(v: Viewport, bucket: number): string {
  const k = (MAP_PX * v.scale) / bucket;
  return `translate(${v.tx}px, ${v.ty}px) scale(${k})`;
}

/** Sub-cell grid appears from this scale (§4.3.3). */
export const SUBGRID_FROM_SCALE = 2;

/** The map point at the centre of the box for a viewport. */
export function viewportCentre(v: Viewport, box: { w: number; h: number }): Point {
  const k = MAP_PX * v.scale;
  return { x: (box.w / 2 - v.tx) / k, y: (box.h / 2 - v.ty) / k };
}

/** Viewport translated so that `p` sits at the centre of the box (scale unchanged). */
export function centreOn(v: Viewport, p: Point, box: { w: number; h: number }): Viewport {
  const k = MAP_PX * v.scale;
  return { scale: v.scale, tx: box.w / 2 - p.x * k, ty: box.h / 2 - p.y * k };
}

/** Scale so the map covers the whole box (crop), centred — the hero frame. */
export function coverBox(box: { w: number; h: number }): Viewport {
  const scale = Math.max(box.w, box.h) / MAP_PX;
  const size = MAP_PX * scale;
  return { scale, tx: (box.w - size) / 2, ty: (box.h - size) / 2 };
}

/** Is a map point inside the visible box (with a margin in screen px)? */
export function isVisible(
  v: Viewport,
  p: Point,
  box: { w: number; h: number },
  marginPx = 24,
): boolean {
  const k = MAP_PX * v.scale;
  const sx = p.x * k + v.tx;
  const sy = p.y * k + v.ty;
  return sx >= marginPx && sy >= marginPx && sx <= box.w - marginPx && sy <= box.h - marginPx;
}
