import { describe, expect, it } from "vitest";
import { MAP_LIST, MAPS } from "@/config/maps";
import { generateTerrain, mapModel, specFor } from "./generate";
import { pointInRing } from "./geometry";
import { MAP_IDS, type SettlementKind, type ZoneAnchorId } from "./types";

const inMap = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const ANCHOR_KIND: Record<ZoneAnchorId, SettlementKind> = {
  default: "town",
  "small-factory": "industry",
  "water-treatment": "water-works",
  houses: "village",
};

describe("generateTerrain", () => {
  it("is deterministic: same seed → deep-equal model; different seeds differ", () => {
    const spec = specFor(MAPS.zestafona);
    const a = generateTerrain(spec);
    const b = generateTerrain(specFor(MAPS.zestafona));
    expect(b).toEqual(a);
    const c = generateTerrain({ ...spec, seed: spec.seed + 1 });
    expect(c.contours).not.toEqual(a.contours);
    expect(Array.from(c.height.slice(0, 64))).not.toEqual(Array.from(a.height.slice(0, 64)));
  });

  it("runs well under a second at res 256", () => {
    const t0 = performance.now();
    generateTerrain(specFor(MAPS.bakurani));
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it("memoises per map", () => {
    expect(mapModel("ozeti")).toBe(mapModel("ozeti"));
    expect(mapModel("ozeti")).not.toBe(mapModel("bakurani"));
    expect(specFor(MAPS.ozeti).names).toEqual(MAPS.ozeti.names);
  });

  for (const def of MAP_LIST) {
    describe(def.name, () => {
      const m = mapModel(def.id);

      it("keeps every zone, POI, settlement, road and polygon inside [0, 1]²", () => {
        expect(m.res).toBe(256);
        expect(m.height).toHaveLength(256 * 256);
        for (const v of m.height) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        for (const z of m.zones) {
          expect(inMap(z.center)).toBe(true);
          expect(z.polygon.length).toBeGreaterThanOrEqual(12);
          expect(z.polygon.length).toBeLessThanOrEqual(20);
          expect(z.polygon.every(inMap)).toBe(true);
          expect(pointInRing(z.center, z.polygon)).toBe(true);
        }
        for (const p of m.pois) expect(inMap(p.at)).toBe(true);
        for (const s of m.settlements) {
          expect(inMap(s.center)).toBe(true);
          for (const b of s.blocks) {
            expect(inMap({ x: b.x, y: b.y })).toBe(true);
            expect(b.w).toBeGreaterThan(0);
            expect(b.h).toBeGreaterThan(0);
          }
        }
        for (const r of m.roads) expect(r.path.every(inMap)).toBe(true);
        for (const ring of [...m.water, ...m.woods, ...m.fields]) {
          expect(ring.length).toBeGreaterThanOrEqual(3);
          expect(ring.every(inMap)).toBe(true);
        }
        for (const c of m.contours) {
          expect(c.path.length).toBeGreaterThanOrEqual(4);
          expect(c.path.every(inMap)).toBe(true);
        }
      });

      it("builds the anchored features of the right kind within 0.05 of each anchor", () => {
        for (const id of Object.keys(def.anchors) as ZoneAnchorId[]) {
          const s = m.settlements.find(
            (x) => x.kind === ANCHOR_KIND[id] && dist(x.center, def.anchors[id]) <= 0.05,
          );
          expect(s, `${id} settlement`).toBeDefined();
          const z = m.zones.find((x) => x.id === id);
          expect(z?.center).toEqual(def.anchors[id]);
          expect(z?.radius).toBe(id === "default" ? 0.075 : 0.06);
        }
        const objective = m.pois.find((p) => p.kind === "objective");
        expect(objective?.at).toEqual(def.anchors.default);
        const factory = m.settlements.find((s) => s.kind === "industry")!;
        expect(factory.blocks.length).toBeGreaterThanOrEqual(4);
        expect(factory.blocks.length).toBeLessThanOrEqual(7);
        const works = m.settlements.find((s) => s.kind === "water-works")!;
        expect(works.blocks.length).toBeGreaterThanOrEqual(3);
        expect(works.blocks.length).toBeLessThanOrEqual(5);
        const houses = m.settlements.find(
          (s) => s.kind === "village" && dist(s.center, def.anchors.houses) <= 0.05,
        )!;
        expect(houses.blocks.length).toBeGreaterThanOrEqual(8);
        expect(houses.blocks.length).toBeLessThanOrEqual(14);
        // The water works sit beside water.
        const nearWater =
          m.rivers.some((r) => r.some((p) => dist(p, works.center) < 0.09)) ||
          m.water.some((w) => w.some((p) => dist(p, works.center) < 0.09));
        expect(nearWater).toBe(true);
      });

      it("names 6–8 flavour POIs from the spec list, in order", () => {
        const flavour = m.pois.filter((p) => p.kind !== "objective");
        expect(flavour.length).toBeGreaterThanOrEqual(6);
        expect(flavour.length).toBeLessThanOrEqual(8);
        expect(flavour.map((p) => p.name)).toEqual(def.names.slice(0, flavour.length));
        expect(new Set(m.pois.map((p) => p.id)).size).toBe(m.pois.length);
        expect(new Set(m.settlements.map((s) => s.id)).size).toBe(m.settlements.length);
      });

      it("has the biome's signature features", () => {
        expect(m.roads.some((r) => r.kind === "main")).toBe(true);
        expect(m.roads.some((r) => r.kind === "rail")).toBe(true);
        expect(m.roads.some((r) => r.kind === "track")).toBe(true);
        expect(m.woods.length).toBeGreaterThan(0);
        expect(m.contours.some((c) => c.index)).toBe(true);
        if (def.biome === "coastal") {
          expect(m.sea).not.toBeNull();
          expect(m.settlements.some((s) => s.kind === "port")).toBe(true);
          expect(m.water.length).toBeGreaterThan(0);
          expect(m.contours.every((c) => c.level > (m.sea ?? 0))).toBe(true);
        } else {
          expect(m.sea).toBeNull();
          expect(m.rivers.length).toBeGreaterThanOrEqual(1);
        }
        if (def.biome === "river-valley") {
          expect(m.rivers.length).toBe(2);
          expect(m.fields.length).toBeGreaterThan(20);
        }
        if (def.biome === "highland") {
          expect(m.settlements.some((s) => s.kind === "quarry")).toBe(true);
          expect(m.water.length).toBe(1);
        }
      });
    });
  }

  it("gives the three maps distinct terrain", () => {
    const ids = MAP_IDS.map((id) => mapModel(id));
    expect(ids[0].contours).not.toEqual(ids[1].contours);
    expect(ids[1].contours).not.toEqual(ids[2].contours);
  });
});
