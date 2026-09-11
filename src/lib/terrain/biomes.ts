import type { Point } from "../geo";
import { clamp01 } from "../geo";
import {
  addPoi,
  addSettlement,
  connect,
  crossing,
  extremePoint,
  highestAlong,
  highestPoint,
  isLand,
  nearestRoadPoint,
  nextName,
  route,
  sharpestBend,
  slopeAt,
  type Layout,
  type World,
} from "./builder";
import {
  blob,
  blocksAlongAxis,
  fieldParcels,
  range,
  scatteredBlocks,
  tankBlocks,
  yardBlocks,
  type Rng,
  int,
} from "./features";
import { pointAlong, sampleGrid } from "./geometry";
import { fbm, ridged, valueNoise2D } from "./noise";
import { CONTROL_ZONE_LABEL, type Biome, type TerrainSpec } from "./types";

export interface BiomeDef {
  layout(rng: Rng, spec: TerrainSpec): Layout;
  /** Roads, flavour settlements, POIs and field clusters, after the anchored features exist. */
  finish(w: World): void;
  woods: { scale: number; threshold: number; minArea: number };
  fields: { clusters: number; radius: number };
}

const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const jitter = (rng: Rng, p: Point, k: number): Point => ({
  x: clamp01(p.x + (rng() - 0.5) * 2 * k),
  y: clamp01(p.y + (rng() - 0.5) * 2 * k),
});

/** Land predicate for block placement: on land, not too steep. */
const buildable =
  (w: World) =>
  (p: Point): boolean =>
    isLand(w, p) && slopeAt(w, p) < 2.2;

/** Fields go on flat, low, dry land away from the zone anchors. */
const arable =
  (w: World, maxSlope: number) =>
  (p: Point): boolean => {
    if (!isLand(w, p) || slopeAt(w, p) > maxSlope) return false;
    if (sampleGrid(w.woodsScore, p.x, p.y) > -0.03) return false;
    for (const a of Object.values(w.spec.anchors))
      if (Math.hypot(a.x - p.x, a.y - p.y) < 0.075) return false;
    for (const s of w.settlements)
      if (Math.hypot(s.center.x - p.x, s.center.y - p.y) < 0.045) return false;
    return true;
  };

/** Pick `n` field-cluster centres from candidates near `near` (a polyline) on arable land. */
function fieldClusters(
  w: World,
  n: number,
  radius: number,
  maxSlope: number,
  candidate: () => Point,
): void {
  const ok = arable(w, maxSlope);
  let tries = 0;
  let made = 0;
  while (made < n && tries++ < n * 30) {
    const c = candidate();
    if (!ok(c)) continue;
    const parcels = fieldParcels(w.rng, c, radius, ok);
    if (parcels.length < 4) continue;
    w.fields.push(...parcels);
    made++;
  }
}

/* ------------------------------------------------------------------------------------------- */
/* River valley — Zestafona                                                                     */
/* ------------------------------------------------------------------------------------------- */

const riverValley: BiomeDef = {
  woods: { scale: 3.4, threshold: 0.585, minArea: 0.0012 },
  fields: { clusters: 6, radius: 0.11 },
  layout(rng, spec) {
    const a = spec.anchors;
    const f = fbm(spec.seed, 4, 2, 0.5);
    const g = fbm(spec.seed ^ 0x51ed, 3, 2, 0.5);
    // Main river: top edge, past the water works, east of the crossroads, out of the bottom edge.
    const river = route(
      rng,
      [
        { x: range(rng, 0.58, 0.66), y: 0 },
        jitter(rng, { x: a["water-treatment"].x - 0.055, y: a["water-treatment"].y - 0.02 }, 0.01),
        jitter(rng, { x: a.default.x + 0.11, y: a.default.y + 0.02 }, 0.012),
        jitter(rng, { x: a.default.x + 0.08, y: a.default.y + 0.2 }, 0.015),
        jitter(rng, { x: 0.5, y: 0.82 }, 0.02),
        { x: range(rng, 0.42, 0.5), y: 1 },
      ],
      0.014,
      9,
    );
    // Tributary from the west, joining south of the crossroads.
    const join = pointAlong(river, 0.62).point;
    const tributary = route(
      rng,
      [
        { x: 0, y: range(rng, 0.3, 0.4) },
        jitter(rng, { x: 0.18, y: 0.46 }, 0.02),
        jitter(rng, { x: 0.36, y: 0.55 }, 0.015),
        join,
      ],
      0.01,
      8,
    );
    return {
      sea: null,
      base: (x, y) =>
        0.4 + 0.42 * f(x * 2.4 + 7.3, y * 2.4 + 1.9) + 0.1 * (g(x * 1.2, y * 1.2) - 0.5),
      rivers: [
        { path: river, width: 0.15, depth: 0.2 },
        { path: river, width: 0.03, depth: 0.05 },
        { path: tributary, width: 0.09, depth: 0.1 },
        { path: tributary, width: 0.022, depth: 0.04 },
      ],
      lakes: [],
      flats: [],
    };
  },
  finish(w) {
    const rng = w.rng;
    const a = w.spec.anchors;
    const [river, tributary] = w.rivers;
    // Main roads through the crossroads.
    const roadA = route(
      rng,
      [
        { x: 0, y: range(rng, 0.46, 0.56) },
        jitter(rng, { x: 0.25, y: 0.5 }, 0.02),
        a.default,
        jitter(rng, { x: 0.76, y: 0.5 }, 0.02),
        { x: 1, y: range(rng, 0.5, 0.6) },
      ],
      0.01,
    );
    const roadB = route(
      rng,
      [
        { x: range(rng, 0.44, 0.52), y: 0 },
        jitter(rng, { x: 0.53, y: 0.24 }, 0.015),
        a.default,
        jitter(rng, { x: 0.47, y: 0.7 }, 0.02),
        { x: range(rng, 0.5, 0.6), y: 1 },
      ],
      0.01,
    );
    w.roads.push({ kind: "main", path: roadA }, { kind: "main", path: roadB });
    // Rail along the west side of the valley, past the factory.
    const rail = route(
      rng,
      [
        { x: range(rng, 0.24, 0.32), y: 0 },
        jitter(rng, { x: 0.35, y: 0.26 }, 0.015),
        jitter(rng, { x: 0.4, y: 0.44 }, 0.012),
        { x: a["small-factory"].x + 0.05, y: a["small-factory"].y - 0.02 },
        jitter(rng, { x: 0.31, y: 0.84 }, 0.015),
        { x: range(rng, 0.26, 0.34), y: 1 },
      ],
      0.004,
    );
    w.roads.push({ kind: "rail", path: rail });
    anchoredSettlements(w, { townRot: [tangentAt(roadA, a.default), tangentAt(roadB, a.default)] });
    const toFactory = connect(w, a["small-factory"]);
    connect(w, a.houses);
    const toWater = connect(w, a["water-treatment"]);
    // Fields on the valley floor.
    fieldClusters(w, riverValley.fields.clusters, riverValley.fields.radius, 1.1, () => {
      const t = rng();
      const src = rng() < 0.65 ? river : tributary;
      const { point, tangent } = pointAlong(src, t);
      const side = rng() < 0.5 ? -1 : 1;
      const d = range(rng, 0.06, 0.2) * side;
      return { x: clamp01(point.x - tangent.y * d), y: clamp01(point.y + tangent.x * d) };
    });
    // Flavour, in name order: a village up the tributary, the mill, a farm hamlet, the bridge, a
    // crossroads with a pond, a lane, a bend, the halt.
    const villageAt = jitter(rng, { x: 0.17, y: 0.34 }, 0.02);
    const villageName = nextName(w);
    addSettlement(w, {
      name: villageName,
      kind: "village",
      center: villageAt,
      blocks: scatteredBlocks(rng, villageAt, 0.026, int(rng, 6, 9), {
        w: [0.007, 0.011],
        h: [0.005, 0.008],
        onLand: buildable(w),
      }),
    });
    addPoi(w, "town", villageAt, villageName);
    connect(w, villageAt);
    const mill = pointAlong(river, 0.16);
    addPoi(w, "industry", {
      x: mill.point.x + mill.tangent.y * 0.02,
      y: mill.point.y - mill.tangent.x * 0.02,
    });
    const farmAt = w.fields.length
      ? fieldCentre(w.fields[Math.floor(w.fields.length * 0.6)])
      : jitter(rng, { x: 0.2, y: 0.72 }, 0.05);
    const farmName = nextName(w);
    addSettlement(w, {
      name: farmName,
      kind: "village",
      center: farmAt,
      blocks: scatteredBlocks(rng, farmAt, 0.018, int(rng, 3, 5), {
        w: [0.007, 0.011],
        h: [0.005, 0.008],
        onLand: buildable(w),
      }),
    });
    addPoi(w, "town", farmAt, farmName);
    const bridge =
      (toWater && crossing(toWater.path, river)) ??
      crossing(roadA, river) ??
      pointAlong(river, 0.3).point;
    addPoi(w, "landmark", bridge);
    const cross = toFactory ? toFactory.path[0] : pointAlong(roadA, 0.3).point;
    addPoi(w, "landmark", cross);
    // A pond beside the crossroads.
    w.water.push(blob(rng, { x: cross.x - 0.035, y: cross.y - 0.03 }, 0.018, 14, 0.3));
    const lane = route(
      rng,
      [
        a["small-factory"],
        jitter(rng, { x: 0.16, y: 0.8 }, 0.03),
        { x: 0, y: range(rng, 0.84, 0.95) },
      ],
      0.008,
    );
    w.roads.push({ kind: "track", path: lane });
    addPoi(w, "landmark", pointAlong(lane, 0.55).point);
    addPoi(w, "water", sharpestBend(river.slice(Math.floor(river.length * 0.55))));
    const haltAt = pointAlong(rail, 0.42).point;
    addPoi(w, "industry", haltAt);
    w.roads.push({
      kind: "track",
      path: route(
        rng,
        [
          haltAt,
          jitter(rng, { x: (haltAt.x + a.default.x) / 2, y: (haltAt.y + a.default.y) / 2 }, 0.02),
          nearestRoadPoint(w, haltAt)?.point ?? a.default,
        ],
        0.006,
        5,
      ),
    });
    w.roads.push({
      kind: "track",
      path: route(
        rng,
        [a.houses, jitter(rng, { x: 0.86, y: 0.8 }, 0.03), { x: 1, y: range(rng, 0.8, 0.9) }],
        0.008,
      ),
    });
  },
};

/* ------------------------------------------------------------------------------------------- */
/* Highland — Bakurani                                                                          */
/* ------------------------------------------------------------------------------------------- */

const highland: BiomeDef = {
  woods: { scale: 3.8, threshold: 0.63, minArea: 0.0009 },
  fields: { clusters: 2, radius: 0.08 },
  layout(rng, spec) {
    const a = spec.anchors;
    const rg = ridged(spec.seed, 4, 2.05, 0.5);
    const f = fbm(spec.seed ^ 0x77a1, 4, 2, 0.5);
    const theta = 0.55;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    // Reservoir west of the water works; stream in from the north, wash out to the south-west.
    const lakeAt = { x: a["water-treatment"].x - 0.075, y: a["water-treatment"].y - 0.035 };
    const lake = blob(rng, lakeAt, 0.042, 20, 0.3);
    const inflow = route(
      rng,
      [{ x: range(rng, 0.26, 0.34), y: 0 }, jitter(rng, { x: 0.24, y: 0.18 }, 0.02), lakeAt],
      0.012,
      8,
    );
    const wash = route(
      rng,
      [
        lakeAt,
        jitter(rng, { x: 0.14, y: 0.5 }, 0.02),
        jitter(rng, { x: 0.1, y: 0.72 }, 0.02),
        { x: 0, y: range(rng, 0.8, 0.92) },
      ],
      0.014,
      8,
    );
    return {
      sea: null,
      base: (x, y) => {
        const xr = x * c - y * s;
        const yr = x * s + y * c;
        const ridge = rg(xr * 1.5 + 3.1, yr * 3.1 + 0.7);
        return 0.28 + 0.48 * ridge + 0.22 * (f(x * 2.2 + 5, y * 2.2 + 9) - 0.5) + 0.06 * (1 - y);
      },
      rivers: [
        { path: inflow, width: 0.03, depth: 0.05 },
        { path: wash, width: 0.05, depth: 0.08 },
      ],
      lakes: [{ ring: lake, level: 0.3 }],
      flats: [
        { at: { x: 0.8, y: 0.17 }, r: 0.04 }, // quarry
        { at: { x: 0.3, y: 0.76 }, r: 0.03 }, // village
      ],
    };
  },
  finish(w) {
    const rng = w.rng;
    const a = w.spec.anchors;
    const roadA = route(
      rng,
      [
        { x: 0, y: range(rng, 0.5, 0.6) },
        jitter(rng, { x: 0.28, y: 0.5 }, 0.015),
        a.default,
        jitter(rng, { x: 0.7, y: 0.5 }, 0.02),
        { x: 1, y: range(rng, 0.42, 0.5) },
      ],
      0.012,
    );
    const roadB = route(
      rng,
      [
        { x: range(rng, 0.38, 0.46), y: 0 },
        jitter(rng, { x: 0.44, y: 0.26 }, 0.02),
        a.default,
        jitter(rng, { x: 0.5, y: 0.72 }, 0.02),
        { x: range(rng, 0.44, 0.5), y: 1 },
      ],
      0.012,
    );
    w.roads.push({ kind: "main", path: roadA }, { kind: "main", path: roadB });
    // Rail from the south edge to the quarry, with a spur to the factory.
    const quarryAt = w.layout.flats[0].at;
    const rail = route(
      rng,
      [
        { x: range(rng, 0.88, 0.94), y: 1 },
        jitter(rng, { x: 0.88, y: 0.7 }, 0.015),
        jitter(rng, { x: 0.85, y: 0.45 }, 0.012),
        quarryAt,
      ],
      0.004,
    );
    const spurFrom = pointAlong(rail, 0.55).point;
    const spur = route(
      rng,
      [spurFrom, { x: a["small-factory"].x + 0.05, y: a["small-factory"].y + 0.015 }],
      0.003,
      6,
    );
    w.roads.push({ kind: "rail", path: rail }, { kind: "rail", path: spur });
    anchoredSettlements(w, { townRot: [tangentAt(roadA, a.default), tangentAt(roadB, a.default)] });
    connect(w, a["small-factory"]);
    connect(w, a.houses);
    connect(w, a["water-treatment"]);
    addPoi(w, "landmark", highestAlong(w, roadB.slice(0, Math.floor(roadB.length * 0.45))));
    // Quarry: pale terraces.
    const quarryName = nextName(w);
    addSettlement(w, {
      name: quarryName,
      kind: "quarry",
      center: quarryAt,
      blocks: scatteredBlocks(rng, quarryAt, 0.03, int(rng, 4, 6), {
        w: [0.018, 0.034],
        h: [0.012, 0.022],
        onLand: () => true,
      }),
    });
    addPoi(w, "industry", quarryAt, quarryName);
    connect(w, quarryAt);
    addPoi(w, "landmark", highestPoint(w));
    addPoi(w, "water", pointAlong(w.rivers[1], 0.85).point);
    const villageAt = w.layout.flats[1].at;
    const villageName = nextName(w);
    addSettlement(w, {
      name: villageName,
      kind: "village",
      center: villageAt,
      blocks: scatteredBlocks(rng, villageAt, 0.028, int(rng, 6, 9), {
        w: [0.007, 0.011],
        h: [0.005, 0.008],
        onLand: buildable(w),
      }),
    });
    addPoi(w, "town", villageAt, villageName);
    connect(w, villageAt);
    addPoi(w, "industry", spur[spur.length - 1]);
    const track = route(
      rng,
      [villageAt, jitter(rng, { x: 0.2, y: 0.9 }, 0.03), { x: range(rng, 0.05, 0.15), y: 1 }],
      0.01,
    );
    w.roads.push({ kind: "track", path: track });
    addPoi(w, "landmark", pointAlong(track, 0.5).point);
    addPoi(w, "landmark", highestAlong(w, roadA.slice(Math.floor(roadA.length * 0.55))));
    w.roads.push({
      kind: "track",
      path: route(
        rng,
        [a.houses, jitter(rng, { x: 0.74, y: 0.84 }, 0.03), { x: 1, y: range(rng, 0.8, 0.9) }],
        0.01,
      ),
    });
    w.roads.push({
      kind: "track",
      path: route(
        rng,
        [
          a["water-treatment"],
          jitter(rng, { x: 0.22, y: 0.24 }, 0.02),
          { x: range(rng, 0.1, 0.2), y: 0 },
        ],
        0.01,
      ),
    });
    fieldClusters(w, highland.fields.clusters, highland.fields.radius, 2.4, () =>
      jitter(rng, rng() < 0.5 ? { x: 0.3, y: 0.62 } : { x: 0.62, y: 0.86 }, 0.08),
    );
  },
};

/* ------------------------------------------------------------------------------------------- */
/* Coastal — Ozeti                                                                              */
/* ------------------------------------------------------------------------------------------- */

function coastFn(seed: number): (y: number) => number {
  const n = valueNoise2D(seed ^ 0x0c0a);
  return (y) =>
    0.79 + 0.05 * (n(y * 3.2 + 0.37, 0.5) - 0.5) * 2 - 0.135 * Math.exp(-(((y - 0.37) / 0.1) ** 2));
}

const coastal: BiomeDef = {
  woods: { scale: 3.6, threshold: 0.6, minArea: 0.001 },
  fields: { clusters: 3, radius: 0.09 },
  layout(rng, spec) {
    const a = spec.anchors;
    const f = fbm(spec.seed, 4, 2, 0.5);
    const rg = ridged(spec.seed ^ 0xd00e, 3, 2, 0.5);
    const coast = coastFn(spec.seed);
    const sea = 0.3;
    // River from the north-west past the water works into the bay's north shore.
    const river = route(
      rng,
      [
        { x: range(rng, 0.26, 0.34), y: 0 },
        jitter(rng, { x: a["water-treatment"].x + 0.05, y: a["water-treatment"].y - 0.02 }, 0.012),
        jitter(rng, { x: 0.5, y: 0.3 }, 0.015),
        { x: coast(0.29) + 0.02, y: 0.29 },
      ],
      0.012,
      8,
    );
    const portAt = { x: coast(0.39) - 0.035, y: 0.39 };
    return {
      sea,
      base: (x, y) => {
        const shore = coast(y) - x;
        const land = 0.36 + 0.4 * f(x * 2.4 + 2.2, y * 2.4 + 4.4) + 0.14 * (1 - x);
        const s = smoothstep(-0.04, 0.05, shore);
        const dune =
          0.045 *
          rg(x * 24, y * 24) *
          Math.exp(-(((shore - 0.08) / 0.045) ** 2)) *
          smoothstep(0.52, 0.62, y);
        return 0.1 + (land - 0.1) * s + dune;
      },
      rivers: [
        { path: river, width: 0.06, depth: 0.1 },
        { path: river, width: 0.02, depth: 0.04 },
      ],
      lakes: [],
      flats: [
        { at: portAt, r: 0.035, min: sea + 0.06 },
        { at: { x: 0.6, y: 0.8 }, r: 0.06, min: sea + 0.03 }, // salt flats
      ],
    };
  },
  finish(w) {
    const rng = w.rng;
    const a = w.spec.anchors;
    const coast = coastFn(w.spec.seed);
    const portAt = w.layout.flats[0].at;
    const inland = (p: Point): Point => ({ x: Math.min(p.x, coast(p.y) - 0.045), y: p.y });
    const roadA = route(
      rng,
      [
        { x: 0, y: range(rng, 0.5, 0.58) },
        jitter(rng, { x: 0.26, y: 0.52 }, 0.02),
        a.default,
        { x: portAt.x - 0.02, y: portAt.y + 0.02 },
      ],
      0.01,
    );
    const roadB = route(
      rng,
      [
        { x: range(rng, 0.46, 0.54), y: 0 },
        jitter(rng, { x: 0.5, y: 0.26 }, 0.015),
        a.default,
        jitter(rng, { x: 0.5, y: 0.74 }, 0.02),
        { x: range(rng, 0.46, 0.54), y: 1 },
      ],
      0.01,
    );
    // Coastal road hugging the shore.
    const coastPts: Point[] = [];
    for (let y = 0; y <= 1.0001; y += 0.1) coastPts.push(inland({ x: coast(y) - 0.05, y }));
    const coastRoad = route(rng, coastPts, 0.006, 5).map(inland);
    w.roads.push(
      { kind: "main", path: roadA },
      { kind: "main", path: roadB },
      { kind: "main", path: coastRoad },
    );
    // Rail from the west edge past the factory to the yard by the port.
    const yardAt = { x: portAt.x + 0.025, y: portAt.y + 0.115 };
    const rail = route(
      rng,
      [
        { x: 0, y: range(rng, 0.62, 0.7) },
        jitter(rng, { x: 0.3, y: 0.62 }, 0.015),
        { x: a["small-factory"].x - 0.01, y: a["small-factory"].y + 0.045 },
        yardAt,
      ],
      0.004,
    );
    w.roads.push({ kind: "rail", path: rail });
    anchoredSettlements(w, { townRot: [tangentAt(roadA, a.default), tangentAt(roadB, a.default)] });
    connect(w, a["small-factory"]);
    connect(w, a.houses);
    connect(w, a["water-treatment"]);
    // Port: warehouses along the quay plus a breakwater into the bay.
    const quayRot = Math.PI / 2 + range(rng, -0.1, 0.1);
    const warehouses = blocksAlongAxis(rng, portAt, quayRot, {
      w: [0.016, 0.026],
      h: [0.009, 0.013],
      perSide: 2,
      spacing: 0.02,
      offset: 0.009,
      keep: 0.9,
      onLand: () => true,
    });
    const breakRot = range(rng, -0.55, -0.35);
    const breakLen = 0.085;
    const breakStart = { x: portAt.x + 0.03, y: portAt.y - 0.01 };
    warehouses.push({
      x: breakStart.x + (Math.cos(breakRot) * breakLen) / 2 - breakLen / 2,
      y: breakStart.y + (Math.sin(breakRot) * breakLen) / 2 - 0.003,
      w: breakLen,
      h: 0.006,
      rot: breakRot,
    });
    addPoi(w, "landmark", {
      x: breakStart.x + Math.cos(breakRot) * breakLen,
      y: breakStart.y + Math.sin(breakRot) * breakLen,
    });
    addPoi(w, "industry", { x: portAt.x - 0.01, y: portAt.y - 0.05 });
    const portName = nextName(w);
    addSettlement(w, { name: portName, kind: "port", center: portAt, blocks: warehouses });
    addPoi(w, "town", portAt, portName);
    const seaRing = w.water[0];
    const headland = seaRing
      ? extremePoint(seaRing, { x: -1, y: 0 }, [0.05, 0.25])
      : { x: coast(0.2), y: 0.2 };
    addPoi(w, "landmark", headland);
    addPoi(w, "landmark", w.layout.flats[1].at);
    addPoi(w, "landmark", pointAlong(coastRoad, 0.8).point);
    const slip = seaRing
      ? extremePoint(seaRing, { x: -1, y: 0 }, [0.44, 0.52])
      : { x: coast(0.48), y: 0.48 };
    addPoi(w, "water", slip);
    addPoi(w, "industry", yardAt);
    w.roads.push({
      kind: "track",
      path: route(rng, [yardAt, { x: portAt.x + 0.01, y: portAt.y + 0.04 }], 0.003, 5),
    });
    w.roads.push({
      kind: "track",
      path: route(
        rng,
        [a.houses, jitter(rng, { x: 0.16, y: 0.8 }, 0.03), { x: 0, y: range(rng, 0.84, 0.94) }],
        0.01,
      ),
    });
    w.roads.push({
      kind: "track",
      path: route(
        rng,
        [
          a["water-treatment"],
          jitter(rng, { x: 0.2, y: 0.2 }, 0.03),
          { x: 0, y: range(rng, 0.1, 0.2) },
        ],
        0.01,
      ),
    });
    fieldClusters(w, coastal.fields.clusters, coastal.fields.radius, 1.4, () =>
      jitter(rng, { x: 0.22, y: 0.42 }, 0.16),
    );
    // Beach: a lighter strip is implied by the dunes; the salt flat gets a track from the coast road.
    w.roads.push({
      kind: "track",
      path: route(rng, [w.layout.flats[1].at, pointAlong(coastRoad, 0.82).point], 0.004, 5),
    });
  },
};

/* ------------------------------------------------------------------------------------------- */
/* Shared                                                                                       */
/* ------------------------------------------------------------------------------------------- */

function tangentAt(path: Point[], p: Point): number {
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < path.length; i++) {
    const dd = Math.hypot(path[i].x - p.x, path[i].y - p.y);
    if (dd < d) {
      d = dd;
      best = i;
    }
  }
  const a = path[Math.max(0, best - 2)];
  const b = path[Math.min(path.length - 1, best + 2)];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function fieldCentre(quad: Point[]): Point {
  return {
    x: quad.reduce((s, p) => s + p.x, 0) / quad.length,
    y: quad.reduce((s, p) => s + p.y, 0) / quad.length,
  };
}

/** The four anchored features every map has (§3.7) plus the town at the crossroads. */
function anchoredSettlements(w: World, o: { townRot: [number, number] }): void {
  const rng = w.rng;
  const a = w.spec.anchors;
  const land = buildable(w);
  const streets = [
    ...blocksAlongAxis(rng, a.default, o.townRot[0], {
      w: [0.012, 0.02],
      h: [0.008, 0.013],
      perSide: 4,
      spacing: 0.02,
      offset: 0.012,
      keep: 0.75,
      skipFirst: true,
      onLand: land,
    }),
    ...blocksAlongAxis(rng, a.default, o.townRot[1], {
      w: [0.012, 0.02],
      h: [0.008, 0.013],
      perSide: 4,
      spacing: 0.02,
      offset: 0.012,
      keep: 0.7,
      skipFirst: true,
      onLand: land,
    }),
  ];
  // Corner plots on the crossroads itself.
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const d = { x: Math.cos(o.townRot[0]), y: Math.sin(o.townRot[0]) };
      const n = { x: Math.cos(o.townRot[1]), y: Math.sin(o.townRot[1]) };
      const p = {
        x: a.default.x + d.x * sx * 0.016 + n.x * sy * 0.016,
        y: a.default.y + d.y * sx * 0.016 + n.y * sy * 0.016,
      };
      if (land(p))
        streets.push({ x: p.x - 0.007, y: p.y - 0.005, w: 0.014, h: 0.01, rot: o.townRot[0] });
    }
  addSettlement(w, {
    name: CONTROL_ZONE_LABEL.default,
    kind: "town",
    center: a.default,
    blocks: streets.slice(0, 24),
  });
  addPoi(w, "objective", a.default, CONTROL_ZONE_LABEL.default);

  const factoryRot = rng() * Math.PI;
  addSettlement(w, {
    name: CONTROL_ZONE_LABEL["small-factory"],
    kind: "industry",
    center: a["small-factory"],
    blocks: yardBlocks(rng, a["small-factory"], factoryRot, int(rng, 4, 7), {
      w: [0.026, 0.036],
      h: [0.016, 0.024],
      cols: 2,
      gap: 0.008,
      onLand: () => true,
    }),
  });
  const waterRot = rng() * Math.PI;
  addSettlement(w, {
    name: CONTROL_ZONE_LABEL["water-treatment"],
    kind: "water-works",
    center: a["water-treatment"],
    blocks: tankBlocks(rng, a["water-treatment"], waterRot, int(rng, 3, 5), [0.013, 0.018]),
  });
  addSettlement(w, {
    name: CONTROL_ZONE_LABEL.houses,
    kind: "village",
    center: a.houses,
    blocks: scatteredBlocks(rng, a.houses, 0.03, int(rng, 8, 14), {
      w: [0.007, 0.011],
      h: [0.005, 0.008],
      onLand: land,
    }),
  });
}

export const BIOMES: Record<Biome, BiomeDef> = {
  "river-valley": riverValley,
  highland,
  coastal,
};
