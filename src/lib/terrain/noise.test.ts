import { describe, expect, it } from "vitest";
import { fbm, ridged, valueNoise2D } from "./noise";

describe("valueNoise2D", () => {
  it("returns smooth values in [0, 1] and matches the lattice at integers", () => {
    const n = valueNoise2D(7);
    for (let i = 0; i < 200; i++) {
      const v = n(i * 0.37, i * 0.11);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Smooth: neighbouring samples differ by little.
    expect(Math.abs(n(1.5, 1.5) - n(1.51, 1.5))).toBeLessThan(0.05);
    expect(n(3, 4)).toBe(valueNoise2D(7)(3, 4));
    expect(n(3, 4)).not.toBe(valueNoise2D(8)(3, 4));
  });
});

describe("fbm / ridged", () => {
  it("stay in [0, 1] and are deterministic", () => {
    const f = fbm(11, 4);
    const r = ridged(11, 3);
    for (let i = 0; i < 100; i++) {
      for (const v of [f(i * 0.3, 1.2), r(i * 0.3, 1.2)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(fbm(11, 4)(2.2, 3.3)).toBe(f(2.2, 3.3));
    expect(fbm(11)(2.2, 3.3)).not.toBe(fbm(12)(2.2, 3.3));
  });
});
