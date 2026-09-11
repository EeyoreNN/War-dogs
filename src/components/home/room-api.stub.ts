/**
 * LOCAL TEST DOUBLE — deleted in Phase 2 (§3.0).
 *
 * The home page reads `isRoomCode` / `normalizeCode` / `RESERVED_CODES` from
 * `src/lib/room/code.ts` (§5.3) and `listRecentRooms` / `forgetRoom` from
 * `src/lib/storage/rooms.ts` (§5.4). Both are WP1 API files that are not merged yet, so this
 * module mirrors their signatures byte-for-byte in behaviour: same alphabet, same regex, same
 * `wardogs:rooms` localStorage key and hand-written guard. Phase 2 swaps the import paths in
 * `code-field.tsx` and `RecentRooms.tsx` and removes this file. No zod here (§7.3).
 */

/* ---- src/lib/room/code.ts ---- */

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RESERVED_CODES = ["DEMO"] as const;

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** Uppercase and strip everything not in `[A-Z2-9]`. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function isRoomCode(s: string): boolean {
  return CODE_RE.test(s);
}

export function isReservedCode(s: string): boolean {
  return (RESERVED_CODES as readonly string[]).includes(s);
}

/* ---- src/lib/storage/rooms.ts ---- */

/** Mirrors `RecentRoom` in `src/lib/map/types.ts` (§3.3). */
export interface RecentRoom {
  code: string;
  team: string;
  map: string;
  controlZone: string;
  role: string;
  updatedAt: number;
}

const ROOMS_KEY = "wardogs:rooms";
const MAX_RECENT = 5;

function isRecentRoom(v: unknown): v is RecentRoom {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.code === "string" &&
    typeof r.team === "string" &&
    typeof r.map === "string" &&
    typeof r.controlZone === "string" &&
    typeof r.role === "string" &&
    typeof r.updatedAt === "number"
  );
}

/** Newest first, at most five. Never throws: bad or missing storage reads as an empty list. */
export function listRecentRooms(): RecentRoom[] {
  try {
    const raw = globalThis.localStorage?.getItem(ROOMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecentRoom)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Drops the room from the recent list and deletes its snapshot. */
export function forgetRoom(code: string): void {
  try {
    const rest = listRecentRooms().filter((r) => r.code !== code);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rest));
    localStorage.removeItem(`wardogs:room:${code}`);
    localStorage.removeItem(`wardogs:room:${code}:bad`);
  } catch {
    /* storage unavailable: nothing to forget */
  }
}
