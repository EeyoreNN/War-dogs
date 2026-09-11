import { isReservedCode, isRoomCode, normalizeCode } from "@/lib/room/code";

export const CODE_ERROR = "Codes are 6 letters or digits, never 0, O, 1 or I.";

/**
 * Where a typed code goes (§4.1): `/room/<CODE>` for a valid code, `/demo` for the reserved
 * `DEMO`, otherwise the inline error. Pure; no zod on the home page (§7.3).
 */
export function resolveCodeRoute(
  input: string,
): { ok: true; href: string } | { ok: false; error: string } {
  const code = normalizeCode(input);
  if (isReservedCode(code)) return { ok: true, href: "/demo" };
  if (isRoomCode(code)) return { ok: true, href: `/room/${code}` };
  return { ok: false, error: CODE_ERROR };
}

/** `just now`, `4 min ago`, `3 h ago`, `2 d ago` — for the Rejoin rows. */
export function formatRelativeTime(then: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}
