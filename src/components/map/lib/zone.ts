// The control zone geometry for a room's settings, from the memoised terrain model (§3.7).
import { mapModel } from "@/lib/terrain/generate";
import type { ControlZone } from "@/lib/terrain/types";
import { mapById } from "@/config/maps";
import type { RoomSettings } from "@/lib/map/types";

export function zoneFor(settings: Pick<RoomSettings, "map" | "controlZone">): ControlZone | null {
  if (settings.controlZone === "none") return null;
  return mapModel(settings.map).zones.find((z) => z.id === settings.controlZone) ?? null;
}

/** Metres across the map for the measure tool; null for uploads (§5.7). */
export function widthMetresFor(settings: Pick<RoomSettings, "map" | "mapSource">): number | null {
  if (settings.mapSource.kind !== "builtin") return null;
  return mapById(settings.map)?.widthMetres ?? null;
}
