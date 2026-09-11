// Relay-reachable: relative imports only (§3.0).
import { asClientId, type ClientId } from "./types";

/** 32 symbols, no 0/O/1/I — the same alphabet as room codes (§5.3). */
export const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ID_LENGTH = 16;
export const CLIENT_ID_LENGTH = 12;
export const CLIENT_ID_PREFIX = "wd_";
/** Node / request / op ids: no ":" (keys.ts), URL-safe, bounded. newId() emits base32; fixtures may not. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
export const CLIENT_ID_PATTERN = /^wd_[A-HJ-NP-Z2-9]{12}$/;

function randomChars(n: number): string {
  const c = globalThis.crypto;
  let out = "";
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint8Array(n);
    c.getRandomValues(buf);
    for (let i = 0; i < n; i++) out += ID_ALPHABET[buf[i] & 31];
    return out;
  }
  for (let i = 0; i < n; i++) out += ID_ALPHABET[Math.floor(Math.random() * 32)];
  return out;
}

/** 16 base32 chars from the crypto RNG (Math.random fallback). */
export function newId(): string {
  return randomChars(ID_LENGTH);
}

/** "wd_" + 12 base32 chars; minted once per browser and kept in localStorage (§5.4). */
export function newClientId(): ClientId {
  return asClientId(CLIENT_ID_PREFIX + randomChars(CLIENT_ID_LENGTH));
}

export const isClientId = (s: string): boolean => CLIENT_ID_PATTERN.test(s);

/** mulberry32: a small deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic ids for scenarios and tests. */
export function seededIds(seed: number): () => string {
  const rnd = mulberry32(seed);
  return () => {
    let s = "";
    for (let i = 0; i < ID_LENGTH; i++) s += ID_ALPHABET[Math.floor(rnd() * 32)];
    return s;
  };
}
