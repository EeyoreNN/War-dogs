// Pure, relay-reachable and zod-free: the home page imports this module (§5.3, §7.3).

/** 32 symbols; no 0/O/1/I. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

/** Valid in routes and as `RoomState.code`, never generated. */
export const RESERVED_CODES = ["DEMO"] as const;
export type ReservedCode = (typeof RESERVED_CODES)[number];

/** Six symbols from `crypto.getRandomValues` (Math.random fallback where crypto is missing). */
export function newRoomCode(): string {
  const c = globalThis.crypto;
  let out = "";
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint8Array(CODE_LENGTH);
    c.getRandomValues(buf);
    for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[buf[i] & 31];
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Math.floor(Math.random() * 32)];
  }
  return isReservedCode(out) ? newRoomCode() : out;
}

/** Uppercase and strip everything outside `[A-Z2-9]` (so "x5gm-4q" and "X5GM 4Q" both work). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export function isRoomCode(s: string): boolean {
  return CODE_PATTERN.test(s);
}

export function isReservedCode(s: string): s is ReservedCode {
  return (RESERVED_CODES as readonly string[]).includes(s);
}

/** FNV-1a 32-bit, unsigned (same as the terrain rng; kept local so this module stays leaf). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Six code symbols from the Discord Activity instance id, stable for that instance (§4.7).
 * 32 bits give six 5-bit symbols with two bits to spare; a second hash round feeds the sixth
 * symbol so every bit of the input reaches the output.
 */
export function codeFromInstance(instanceId: string): string {
  const h1 = fnv1a(instanceId);
  const h2 = fnv1a(instanceId + "#" + h1.toString(16));
  let out = "";
  for (let i = 0; i < 5; i++) out += CODE_ALPHABET[(h1 >>> (i * 5)) & 31];
  out += CODE_ALPHABET[h2 & 31];
  return out;
}
