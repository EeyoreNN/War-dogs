import { MAPS } from "@/config/maps";
import type { Point } from "../geo";
import { BIOMES } from "./biomes";
import type { World } from "./builder";
import { contourLines } from "./contours";
import { maskRings, zonePolygon } from "./features";
import {
  distToPolyline,
  distToSegmentSq,
  ringArea,
  sampleGrid,
  simplify,
  type Grid,
} from "./geometry";
import { fbm } from "./noise";
import { mulberry32 } from "./rng";
import type { MapDef, MapId, TerrainModel, TerrainSpec, ZoneAnchorId } from "./types";

export const DEFAULT_RES = 256;
/** RDP tolerance for the model's own (full-detail) contours, in map units. */
export const FULL_EPS = 0.0008;

export function specFor(def: MapDef): TerrainSpec {
  return {
    seed: def.seed,
    res: DEFAULT_RES,
    biome: def.biome,
    anchors: def.anchors,
    names: [...def.names],
  };
}

/**
 * Minimum distance from every grid cell to a polyline, capped at `cutoff`. Segments are bucketed
 * so the cost is proportional to the river's footprint, not the whole map.
 */
function distanceField(path: Point[], res: number, cutoff: number): Float32Array {
  const out = new Float32Array(res * res).fill(cutoff);
  const cells = Math.ceil(cutoff * (res - 1));
  for (let s = 1; s < path.length; s++) {
    const a = path[s - 1];
    const b = path[s];
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) * (res - 1)) - cells);
    const x1 = Math.min(res - 1, Math.ceil(Math.max(a.x, b.x) * (res - 1)) + cells);
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) * (res - 1)) - cells);
    const y1 = Math.min(res - 1, Math.ceil(Math.max(a.y, b.y) * (res - 1)) + cells);
    for (let j = y0; j <= y1; j++) {
      const y = j / (res - 1);
      for (let i = x0; i <= x1; i++) {
        const d = Math.sqrt(distToSegmentSq({ x: i / (res - 1), y }, a, b));
        const k = j * res + i;
        if (d < out[k]) out[k] = d;
      }
    }
  }
  return out;
}

function buildHeightfield(spec: TerrainSpec, layout: World["layout"]): Grid {
  const res = spec.res;
  const data = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    const y = j / (res - 1);
    for (let i = 0; i < res; i++) data[j * res + i] = layout.base(i / (res - 1), y);
  }
  // Rivers carve valleys; identical paths share one distance field.
  const fields = new Map<Point[], Float32Array>();
  for (const river of layout.rivers) {
    let df = fields.get(river.path);
    if (!df) {
      const cutoff =
        Math.max(...layout.rivers.filter((r) => r.path === river.path).map((r) => r.width)) * 2.4;
      df = distanceField(river.path, res, cutoff);
      fields.set(river.path, df);
    }
    const w2 = river.width * river.width;
    for (let k = 0; k < data.length; k++) {
      const d = df[k];
      if (d < river.width * 2.4) data[k] -= river.depth * Math.exp(-(d * d) / w2);
    }
  }
  // Lakes: flat bed with a soft rim.
  for (const lake of layout.lakes) {
    const ring = lake.ring;
    const closed = [...ring, ring[0]];
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const rim = 0.035;
    const i0 = Math.max(0, Math.floor((minX - rim) * (res - 1)));
    const i1 = Math.min(res - 1, Math.ceil((maxX + rim) * (res - 1)));
    const j0 = Math.max(0, Math.floor((minY - rim) * (res - 1)));
    const j1 = Math.min(res - 1, Math.ceil((maxY + rim) * (res - 1)));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const p = { x: i / (res - 1), y: j / (res - 1) };
        const d = distToPolyline(p, closed);
        let inside = false;
        for (let u = 0, v = ring.length - 1; u < ring.length; v = u++) {
          const a = ring[u];
          const b = ring[v];
          if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
            inside = !inside;
        }
        const k = j * res + i;
        if (inside) data[k] = lake.level - 0.012;
        else if (d < rim) {
          const t = d / rim;
          const s = t * t * (3 - 2 * t);
          data[k] = Math.min(data[k], lake.level + 0.05 * s + (data[k] - lake.level - 0.05) * s);
        }
      }
  }
  // Flats: settlements and zones sit on levelled ground.
  const grid = { data, res };
  const flats = [
    ...(Object.keys(spec.anchors) as ZoneAnchorId[]).map((id) => ({
      at: spec.anchors[id],
      r: 0.045,
      min: undefined as number | undefined,
    })),
    ...layout.flats,
  ];
  for (const flat of flats) {
    let hc = sampleGrid(grid, flat.at.x, flat.at.y);
    if (flat.min !== undefined) hc = Math.max(hc, flat.min);
    const reach = flat.r * 2.6;
    const i0 = Math.max(0, Math.floor((flat.at.x - reach) * (res - 1)));
    const i1 = Math.min(res - 1, Math.ceil((flat.at.x + reach) * (res - 1)));
    const j0 = Math.max(0, Math.floor((flat.at.y - reach) * (res - 1)));
    const j1 = Math.min(res - 1, Math.ceil((flat.at.y + reach) * (res - 1)));
    const r2 = flat.r * flat.r;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = i / (res - 1) - flat.at.x;
        const dy = j / (res - 1) - flat.at.y;
        const wgt = Math.exp(-(dx * dx + dy * dy) / r2);
        const k = j * res + i;
        data[k] += (hc - data[k]) * wgt;
      }
  }
  for (let k = 0; k < data.length; k++) data[k] = Math.min(0.98, Math.max(0.02, data[k]));
  return grid;
}

/** Woodland score at res 128: noise minus water, settlements and steep ground. */
function woodsScore(
  spec: TerrainSpec,
  grid: Grid,
  sea: number | null,
  exclude: Point[],
  scale: number,
  threshold: number,
): Grid {
  const res = 128;
  const data = new Float32Array(res * res);
  const n = fbm(spec.seed ^ 0x9e37, 4, 2.1, 0.5);
  const m = fbm(spec.seed ^ 0x1b87, 2, 2, 0.5);
  for (let j = 0; j < res; j++) {
    const y = j / (res - 1);
    for (let i = 0; i < res; i++) {
      const x = i / (res - 1);
      let s = n(x * scale + 11.7, y * scale + 3.3) - threshold + 0.12 * (m(x * 1.4, y * 1.4) - 0.5);
      const h = sampleGrid(grid, x, y);
      if (sea !== null) s -= Math.max(0, sea + 0.05 - h) * 6;
      for (const p of exclude) {
        const d = Math.hypot(p.x - x, p.y - y);
        s -= 0.3 * Math.exp(-(d * d) / (0.045 * 0.045));
      }
      // Keep the map edge clean of half rings.
      const edge = Math.min(x, y, 1 - x, 1 - y);
      if (edge < 0.012) s = -1;
      data[j * res + i] = s;
    }
  }
  return { data, res };
}

/** Deterministic procedural terrain from a spec (§3.7). */
export function generateTerrain(spec: TerrainSpec): TerrainModel {
  const rng = mulberry32(spec.seed);
  const biome = BIOMES[spec.biome];
  const layout = biome.layout(rng, spec);
  const grid = buildHeightfield(spec, layout);
  const sea = layout.sea;

  // Water: the sea (cells at or below sea level) and any lakes.
  const water: Point[][] = [];
  if (sea !== null) {
    // maskRings thresholds at 0: shift so "≥ 0" means h ≤ sea.
    const below = { data: grid.data.map((v) => sea - v), res: grid.res };
    for (const ring of maskRings(below, FULL_EPS, 0.0006)) water.push(ring);
  }
  for (const lake of layout.lakes) water.push(simplify(lake.ring, FULL_EPS, true));

  const w: World = {
    spec,
    rng,
    grid,
    sea,
    layout,
    rivers: [],
    water,
    roads: [],
    settlements: [],
    pois: [],
    fields: [],
    woods: [],
    woodsScore: { data: new Float32Array(0), res: 0 },
    names: [...spec.names],
  };
  // Unique river paths, simplified for the model; a river that reaches the sea stops at the shore.
  const seen = new Set<Point[]>();
  for (const r of layout.rivers) {
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    let path = r.path;
    if (sea !== null) {
      const cut = path.findIndex(
        (p, i) => i > path.length / 2 && sampleGrid(grid, p.x, p.y) <= sea + 0.005,
      );
      if (cut > 2) path = path.slice(0, cut + 1);
    }
    w.rivers.push(simplify(path, FULL_EPS * 0.5));
  }
  const excluded = Object.values(spec.anchors).concat(layout.flats.map((f) => f.at));
  w.woodsScore = woodsScore(spec, grid, sea, excluded, biome.woods.scale, biome.woods.threshold);

  biome.finish(w);

  // Woods: rings of the score grid, minus anything under a settlement placed during finish.
  const settled = w.settlements.map((s) => s.center);
  const score = w.woodsScore;
  for (let j = 0; j < score.res; j++)
    for (let i = 0; i < score.res; i++) {
      const x = i / (score.res - 1);
      const y = j / (score.res - 1);
      let s = score.data[j * score.res + i];
      for (const p of settled) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 0.06) s -= 0.3 * Math.exp(-(d * d) / (0.03 * 0.03));
      }
      score.data[j * score.res + i] = s;
    }
  w.woods = maskRings(score, 0.002, biome.woods.minArea);

  const zones = (Object.keys(spec.anchors) as ZoneAnchorId[]).map((id) =>
    zonePolygon(rng, id, spec.anchors[id]),
  );

  return {
    spec,
    res: grid.res,
    height: grid.data,
    sea,
    contours: contourLines(grid, sea, FULL_EPS),
    water: w.water.filter((ring) => Math.abs(ringArea(ring)) > 0),
    rivers: w.rivers,
    roads: w.roads,
    settlements: w.settlements,
    woods: w.woods,
    fields: w.fields,
    pois: w.pois,
    zones,
  };
}

const cache = new Map<MapId, TerrainModel>();

/** Memoised model per built-in map. */
export function mapModel(id: MapId): TerrainModel {
  let model = cache.get(id);
  if (!model) {
    model = generateTerrain(specFor(MAPS[id]));
    cache.set(id, model);
  }
  return model;
}
