/**
 * Small, dependency-free hashing and PRNG for the simulator. Everything the sim shows is a
 * pure function of (seed, match number, player index, …) so two tabs — or two visitors —
 * looking at the same instant see the same world.
 */

/** FNV-1a 32-bit over a string, unsigned. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix any number of integer parts into one 32-bit unsigned hash (order-sensitive). */
export function hash32(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    let x = (p | 0) ^ (h >>> 0);
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    h = (x ^ (x >>> 16)) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic [0, 1) generator (mulberry32). */
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

/** One uniform draw in [0, 1) for a key tuple — no generator state to thread around. */
export function unit(...parts: number[]): number {
  return hash32(...parts) / 4294967296;
}

/** Integer in [min, max] for a key tuple. */
export function int(min: number, max: number, ...parts: number[]): number {
  return min + Math.floor(unit(...parts) * (max - min + 1));
}
