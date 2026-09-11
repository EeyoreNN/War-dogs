import { hashLattice } from "./rng";

/**
 * Smooth 2-D value noise in [0, 1]. Lattice values are hashed from the seed, interpolated with a
 * quintic fade so contours stay smooth (fewer vertices after simplification).
 */
export function valueNoise2D(seed: number): (x: number, y: number) => number {
  const inv = 1 / 4294967296;
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = hashLattice(seed, x0, y0) * inv;
    const b = hashLattice(seed, x0 + 1, y0) * inv;
    const c = hashLattice(seed, x0, y0 + 1) * inv;
    const d = hashLattice(seed, x0 + 1, y0 + 1) * inv;
    const top = a + (b - a) * ux;
    const bottom = c + (d - c) * ux;
    return top + (bottom - top) * uy;
  };
}

/**
 * Fractional Brownian motion over `valueNoise2D`, normalised back to [0, 1]. Each octave uses its
 * own lattice seed so octaves do not align.
 */
export function fbm(
  seed: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): (x: number, y: number) => number {
  const layers: ((x: number, y: number) => number)[] = [];
  for (let i = 0; i < octaves; i++) layers.push(valueNoise2D((seed + i * 0x3c6ef372) >>> 0));
  let norm = 0;
  let amp = 1;
  for (let i = 0; i < octaves; i++) {
    norm += amp;
    amp *= gain;
  }
  return (x, y) => {
    let sum = 0;
    let a = 1;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += layers[i](x * f, y * f) * a;
      a *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  };
}

/** Ridged multifractal built on `fbm`'s octaves: sharp crests, soft valleys. [0, 1]. */
export function ridged(
  seed: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): (x: number, y: number) => number {
  const layers: ((x: number, y: number) => number)[] = [];
  for (let i = 0; i < octaves; i++) layers.push(valueNoise2D((seed + i * 0x27d4eb2f) >>> 0));
  let norm = 0;
  let amp = 1;
  for (let i = 0; i < octaves; i++) {
    norm += amp;
    amp *= gain;
  }
  return (x, y) => {
    let sum = 0;
    let a = 1;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      const v = 1 - Math.abs(layers[i](x * f, y * f) * 2 - 1);
      sum += v * v * a;
      a *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  };
}
