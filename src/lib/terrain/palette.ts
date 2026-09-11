import type { Biome } from "./types";

export interface BiomePalette {
  ground: string;
  low: string;
  high: string;
  water: string;
  road: string;
  block: string;
  wood: string;
  field: string;
  contour: string;
  label: string;
}

/**
 * Desaturated, mid-value palettes so amber, blue and red ink pop on top (§2.3). Every `ground`
 * sits at relative luminance 0.15–0.19; `low`/`high` are the hypsometric ends (≈ ±8 % luminance).
 */
const PALETTES: Record<Biome, BiomePalette> = {
  "river-valley": {
    ground: "#6a715d",
    low: "#5f6b56",
    high: "#7b7a64",
    water: "#4f7283",
    road: "#c2b79f",
    block: "#d9d3c3",
    wood: "#3d5a3a",
    field: "#b3ae6a",
    contour: "#f1ebdd",
    label: "#f5f0e4",
  },
  highland: {
    ground: "#767062",
    low: "#6a6a5e",
    high: "#8b8270",
    water: "#527686",
    road: "#c8bda6",
    block: "#ded8c8",
    wood: "#4a5f45",
    field: "#b1a86e",
    contour: "#f1ebdd",
    label: "#f5f0e4",
  },
  coastal: {
    ground: "#6c7368",
    low: "#647462",
    high: "#867f6d",
    water: "#3f6b82",
    road: "#c3b9a6",
    block: "#dcd6c8",
    wood: "#415940",
    field: "#aaa66c",
    contour: "#f1ebdd",
    label: "#f5f0e4",
  },
};

export function biomePalette(biome: Biome): BiomePalette {
  return { ...PALETTES[biome] };
}

/* ---- colour maths (shared by the SVG and canvas renderers) ---- */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two hex colours in sRGB space. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** WCAG relative luminance of a hex colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Brand amber and ink, as literals for renderers that cannot read CSS tokens. */
export const ACCENT = "#ffa028";
export const ACCENT_INK = "#141311";
