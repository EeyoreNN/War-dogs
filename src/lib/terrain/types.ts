import type { Point, Rect } from "../geo";

export const MAP_IDS = ["zestafona", "bakurani", "ozeti"] as const;
export type MapId = (typeof MAP_IDS)[number];

export const CONTROL_ZONE_IDS = [
  "default",
  "small-factory",
  "water-treatment",
  "houses",
  "none",
] as const;
export type ControlZoneId = (typeof CONTROL_ZONE_IDS)[number];
export type ZoneAnchorId = Exclude<ControlZoneId, "none">;

export const CONTROL_ZONE_LABEL: Record<ControlZoneId, string> = {
  default: "Default",
  "small-factory": "Small Factory",
  "water-treatment": "Water Treatment",
  houses: "Houses",
  none: "None",
};

export type Biome = "river-valley" | "highland" | "coastal";

export type SettlementKind = "town" | "village" | "industry" | "water-works" | "port" | "quarry";
export interface Settlement {
  id: string;
  name: string;
  kind: SettlementKind;
  center: Point;
  blocks: Rect[];
}

export type PoiKind = "town" | "industry" | "water" | "landmark" | "objective";
export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  at: Point;
}

export interface ControlZone {
  id: ZoneAnchorId;
  name: string;
  center: Point;
  /** Fraction of map width. Default zone 0.075; others 0.06. */
  radius: number;
  /** 12–20 vertices, roughly circular, deterministic from the seed. */
  polygon: Point[];
}

export interface TerrainSpec {
  seed: number;
  /** Heightfield resolution per side (default 256). */
  res: number;
  biome: Biome;
  /** Fixed zone anchors from src/config/maps.ts; the generator builds matching features here. */
  anchors: Record<ZoneAnchorId, Point>;
  /** Invented place names to assign to settlements/POIs in order. */
  names: string[];
}

export interface Contour {
  level: number;
  /** Every 5th contour is an index contour (drawn heavier). */
  index: boolean;
  path: Point[];
}
export type RoadKind = "main" | "track" | "rail";
export interface Road {
  kind: RoadKind;
  path: Point[];
}

export interface TerrainModel {
  spec: TerrainSpec;
  res: number;
  /** res*res heights in [0, 1], row-major. */
  height: Float32Array;
  /** Sea level for coastal biome, else null. */
  sea: number | null;
  contours: Contour[];
  /** Closed polygons: lakes, sea. */
  water: Point[][];
  rivers: Point[][];
  roads: Road[];
  settlements: Settlement[];
  /** Closed polygons for woodland stipple. */
  woods: Point[][];
  /** Closed polygons for field patchwork. */
  fields: Point[][];
  pois: Poi[];
  zones: ControlZone[];
}

export interface MapDef {
  id: MapId;
  name: string;
  seed: number;
  biome: Biome;
  /** Approximate width of the map in metres; used by the measure tool. */
  widthMetres: number;
  anchors: Record<ZoneAnchorId, Point>;
  names: string[];
  /** One line shown in the create-page map card. */
  blurb: string;
}
