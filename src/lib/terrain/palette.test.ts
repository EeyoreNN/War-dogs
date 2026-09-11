import { describe, expect, it } from "vitest";
import {
  ACCENT,
  biomePalette,
  contrastRatio,
  hexToRgb,
  mix,
  relativeLuminance,
  rgbToHex,
} from "./palette";
import type { Biome } from "./types";

const BIOMES: Biome[] = ["river-valley", "highland", "coastal"];

describe("biomePalette", () => {
  it("keeps every ground at relative luminance 0.15–0.19 so ink stays legible (§2.3)", () => {
    for (const b of BIOMES) {
      const p = biomePalette(b);
      const l = relativeLuminance(p.ground);
      expect(l).toBeGreaterThanOrEqual(0.15);
      expect(l).toBeLessThanOrEqual(0.19);
      expect(contrastRatio(p.ground, "#ffffff")).toBeGreaterThanOrEqual(3.5);
      expect(contrastRatio(p.ground, "#000000")).toBeGreaterThanOrEqual(3.5);
      expect(relativeLuminance(p.low)).toBeLessThan(relativeLuminance(p.high));
    }
  });
  it("gives each biome a distinct palette and copies on read", () => {
    const grounds = new Set(BIOMES.map((b) => biomePalette(b).ground));
    expect(grounds.size).toBe(3);
    const p = biomePalette("coastal");
    p.ground = "#000000";
    expect(biomePalette("coastal").ground).not.toBe("#000000");
  });
  it("colour maths round-trips", () => {
    expect(rgbToHex(hexToRgb("#ffa028"))).toBe(ACCENT);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
  });
});
