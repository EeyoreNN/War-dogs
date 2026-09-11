import { site } from "@/config/site";
import type { ControlZoneId, MapId } from "./types";

export type TerrainSize = 320 | 640 | 1024;
export interface TerrainUrlOptions {
  size?: TerrainSize;
  zone?: ControlZoneId;
  grid?: boolean;
  labels?: boolean;
}

/**
 * URL of the cached `/terrain/<map>.svg` route (§3.7). Always carries `v=site.version` so the
 * immutable cache busts on deploy. Defaults: 1024, zone none, grid off, labels on.
 */
export function terrainUrl(map: MapId, opts: TerrainUrlOptions = {}): string {
  const size = opts.size ?? 1024;
  const zone = opts.zone ?? "none";
  const grid = opts.grid ? 1 : 0;
  const labels = opts.labels === false ? 0 : 1;
  return `/terrain/${map}.svg?size=${size}&zone=${zone}&grid=${grid}&labels=${labels}&v=${site.version}`;
}
