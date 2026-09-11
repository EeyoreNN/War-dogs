// Zod-free callsign check for the /create and /join forms (§7.3: those routes stay under the
// 200 kB app budget, and `@/lib/map/schema` pulls zod in). Mirrors `CallsignSchema` exactly —
// trim, 2..24 code points (zod 4 counts `[...s].length`), no C0 control or DEL — and the unit
// test pins the two together.
export const CALLSIGN_MIN = 2;
export const CALLSIGN_MAX = 24;

// Built without a literal control character so the source stays greppable.
const CONTROL_CHARS = new RegExp("[\\x00-\\x1f\\x7f]");

/** The trimmed callsign, or null when it would not pass `CallsignSchema`. */
export function parseCallsign(input: string): string | null {
  const v = input.trim();
  const length = [...v].length;
  if (length < CALLSIGN_MIN || length > CALLSIGN_MAX) return null;
  if (CONTROL_CHARS.test(v)) return null;
  return v;
}
