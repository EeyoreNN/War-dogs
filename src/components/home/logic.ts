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
