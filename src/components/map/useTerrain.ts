"use client";

// Draws the terrain onto the canvas behind the SVG (§4.3.2): the built-in map from the memoised
// ImageBitmap at the current resolution bucket, or the commander's uploaded map from IDB (the
// uploader's `full` variant, everyone else's `shared` one — identical geometry, §5.7).
import * as React from "react";
import { getMap } from "@/lib/storage/idb";
import { mapModel } from "@/lib/terrain/generate";
import { terrainBitmap } from "@/lib/terrain/draw-canvas";
import { MAP_PX, type MapSource, type MapId } from "@/lib/map/types";

const uploadedBitmaps = new Map<string, Promise<ImageBitmap | null>>();

async function uploadedBitmap(hash: string): Promise<ImageBitmap | null> {
  let hit = uploadedBitmaps.get(hash);
  if (!hit) {
    hit = (async () => {
      const rec = await getMap(hash);
      if (!rec) return null;
      try {
        return await createImageBitmap(rec.full ?? rec.shared);
      } catch {
        return null;
      }
    })();
    uploadedBitmaps.set(hash, hit);
    hit.then((b) => {
      if (!b) uploadedBitmaps.delete(hash);
    });
  }
  return hit;
}

export function resetUploadedBitmaps(): void {
  uploadedBitmaps.clear();
}

/** The raster to draw for `source` (null while an upload is missing → the schematic map). */
export async function terrainRaster(
  map: MapId,
  source: MapSource,
  bucket: number,
  uploadReady: boolean,
): Promise<ImageBitmap | null> {
  if (source.kind === "upload" && uploadReady) {
    const bmp = await uploadedBitmap(source.hash);
    if (bmp) return bmp;
  }
  return terrainBitmap(mapModel(map), bucket);
}

export function useTerrainCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  map: MapId,
  source: MapSource,
  bucket: number,
  uploadReady: boolean,
): void {
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void terrainRaster(map, source, bucket, uploadReady).then((bmp) => {
      if (cancelled || !bmp) return;
      canvas.width = bucket;
      canvas.height = bucket;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, bucket, bucket);
      ctx.drawImage(bmp, 0, 0, bucket, bucket);
    });
    return () => {
      cancelled = true;
    };
  }, [canvasRef, map, source, bucket, uploadReady]);
}

/** Full-resolution raster for PNG export. */
export function exportRaster(map: MapId, source: MapSource, uploadReady: boolean) {
  return terrainRaster(map, source, MAP_PX, uploadReady);
}
