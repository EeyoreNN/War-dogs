// `wardogs:rooms` (§5.4): RecentRoom[] (max 5, newest first). Hand-written guard, no zod — the
// home page's Rejoin cards import this module (§7.3). Forgetting a room also drops its snapshot.
import { CONTROL_ZONE_IDS, MAP_IDS } from "../terrain/types";
import { site } from "../../config/site";
import type { RecentRoom } from "../map/types";
import { KEY_ROOMS, MAX_RECENT_ROOMS, roomBadKey, roomKey } from "./keys";
import { readJson, removeLocal, writeJson } from "./local";

const ROLES = ["commander", "co-commander", "member"] as const;
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

function guardRoom(raw: unknown): RecentRoom | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.code !== "string" || !CODE.test(o.code)) return null;
  if (!(site.game.teams as readonly string[]).includes(o.team as string)) return null;
  if (!(MAP_IDS as readonly string[]).includes(o.map as string)) return null;
  if (!(CONTROL_ZONE_IDS as readonly string[]).includes(o.controlZone as string)) return null;
  if (!(ROLES as readonly string[]).includes(o.role as string)) return null;
  if (typeof o.updatedAt !== "number" || !Number.isFinite(o.updatedAt)) return null;
  return {
    code: o.code,
    team: o.team as RecentRoom["team"],
    map: o.map as RecentRoom["map"],
    controlZone: o.controlZone as RecentRoom["controlZone"],
    role: o.role as RecentRoom["role"],
    updatedAt: o.updatedAt,
  };
}

/** Newest first, at most 5, never the demo. */
export function listRecentRooms(): RecentRoom[] {
  const raw = readJson<unknown>(KEY_ROOMS);
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: RecentRoom[] = [];
  for (const item of raw) {
    const r = guardRoom(item);
    if (!r || seen.has(r.code)) continue;
    seen.add(r.code);
    out.push(r);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_RECENT_ROOMS);
}

/** Insert or refresh a room at the top; rooms that fall off the end lose their snapshot. */
export function touchRecentRoom(r: RecentRoom): RecentRoom[] {
  if (!CODE.test(r.code)) return listRecentRooms();
  const rest = listRecentRooms().filter((x) => x.code !== r.code);
  const next = [r, ...rest];
  const kept = next.slice(0, MAX_RECENT_ROOMS);
  for (const dropped of next.slice(MAX_RECENT_ROOMS)) {
    removeLocal(roomKey(dropped.code));
    removeLocal(roomBadKey(dropped.code));
  }
  writeJson(KEY_ROOMS, kept);
  return kept;
}

/** Remove the room from the index and delete its snapshot (and any quarantine). */
export function forgetRoom(code: string): RecentRoom[] {
  const kept = listRecentRooms().filter((x) => x.code !== code);
  writeJson(KEY_ROOMS, kept);
  removeLocal(roomKey(code));
  removeLocal(roomBadKey(code));
  return kept;
}
