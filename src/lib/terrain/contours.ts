import type { Contour } from "./types";
import { isolinesPadded, padGrid, simplify, type Grid } from "./geometry";

/** Contour interval in height units; every 5th level (0.25, 0.5, 0.75) is an index contour. */
export const CONTOUR_STEP = 0.05;

/** Levels drawn for a model: every step from 0.05 to 0.95, skipping anything at or below sea. */
export function contourLevels(sea: number | null): number[] {
  const out: number[] = [];
  for (let k = 1; k < 20; k++) {
    const level = k * CONTOUR_STEP;
    if (sea !== null && level <= sea + 1e-6) continue;
    out.push(level);
  }
  return out;
}

/**
 * Closed contour rings for every level, simplified with RDP at `eps` (map units). The grid is
 * padded below every level, so filling a level's rings with the even-odd rule paints the area at
 * or above that level — the SVG renderer uses the same path for the hypsometric band and the line.
 */
export function contourLines(grid: Grid, sea: number | null, eps: number): Contour[] {
  const out: Contour[] = [];
  const pad = padGrid(grid, -1);
  for (const level of contourLevels(sea)) {
    const k = Math.round(level / CONTOUR_STEP);
    const index = k % 5 === 0;
    for (const ring of isolinesPadded(pad, grid.res, level)) {
      const path = simplify(ring, eps, true);
      if (path.length >= 4) out.push({ level, index, path });
    }
  }
  return out;
}
