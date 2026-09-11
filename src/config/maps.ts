import type { MapDef, MapId } from "@/lib/terrain/types";

export const MAPS: Record<MapId, MapDef> = {
  zestafona: {
    id: "zestafona",
    name: "Zestafona",
    seed: 0x5a45_5354,
    biome: "river-valley",
    widthMetres: 2400,
    anchors: {
      default: { x: 0.5, y: 0.47 },
      "small-factory": { x: 0.3, y: 0.62 },
      "water-treatment": { x: 0.66, y: 0.28 },
      houses: { x: 0.72, y: 0.68 },
    },
    names: ["Verano", "Old Mill", "Kesler Farm", "North Bridge", "Tarn Cross", "Hollow Road", "Sedge Bend", "Rail Halt"],
    blurb: "Farmland, a river and a town in the middle. Open approaches.",
  },
  bakurani: {
    id: "bakurani",
    name: "Bakurani",
    seed: 0x4241_4b55,
    biome: "highland",
    widthMetres: 2000,
    anchors: {
      default: { x: 0.48, y: 0.52 },
      "small-factory": { x: 0.68, y: 0.36 },
      "water-treatment": { x: 0.26, y: 0.4 },
      houses: { x: 0.58, y: 0.74 },
    },
    names: ["Saddle", "Quarry Gate", "Pylon Ridge", "Dry Wash", "Kovar", "The Spur", "Shepherd's Rest", "High Cut"],
    blurb: "Ridges and a quarry. Long sightlines, hard cover.",
  },
  ozeti: {
    id: "ozeti",
    name: "Ozeti",
    seed: 0x4f5a_4554,
    biome: "coastal",
    widthMetres: 2200,
    anchors: {
      default: { x: 0.52, y: 0.5 },
      "small-factory": { x: 0.64, y: 0.62 },
      "water-treatment": { x: 0.34, y: 0.3 },
      houses: { x: 0.28, y: 0.66 },
    },
    names: ["Breakwater", "Cannery", "Fish Market", "Lighthouse Point", "Salt Flats", "Dune Road", "Ferry Slip", "Container Yard"],
    blurb: "A port, an industrial block and the sea on one side.",
  },
};
export const MAP_LIST: MapDef[] = [MAPS.zestafona, MAPS.bakurani, MAPS.ozeti];
/** Case-insensitive; accepts ids ("ozeti") and display names ("Ozeti"). */
export function mapById(id: string): MapDef | null {
  const key = id.trim().toLowerCase();
  return MAP_LIST.find((m) => m.id === key || m.name.toLowerCase() === key) ?? null;
}
