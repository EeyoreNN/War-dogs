// 10×10 grid references (§3.4): columns A–J left→right, rows 1–10 top→bottom, keypad sub-cells
// laid out like a phone keypad rotated for maps: 7 8 9 on top, 4 5 6 in the middle, 1 2 3 at the
// bottom (1 = bottom-left).
import { clamp01 } from "../geo";
import type { Point } from "../geo";

export const GRID_COLS = "ABCDEFGHIJ";
export const GRID_N = 10;

const cellIndex = (v: number): number => Math.min(GRID_N - 1, Math.floor(clamp01(v) * GRID_N));

/** "D7" or, with `sub`, "D7-3". */
export function gridRef(p: Point, sub = false): string {
  const col = cellIndex(p.x);
  const row = cellIndex(p.y);
  const ref = `${GRID_COLS[col]}${row + 1}`;
  if (!sub) return ref;
  const fx = clamp01(p.x) * GRID_N - col;
  const fy = clamp01(p.y) * GRID_N - row;
  const sc = Math.min(2, Math.floor(fx * 3));
  const sr = Math.min(2, Math.floor(fy * 3));
  const digit = (2 - sr) * 3 + sc + 1;
  return `${ref}-${digit}`;
}

const REF = /^([A-J])(10|[1-9])(?:-([1-9]))?$/;

/** Bounds of a cell or sub-cell in map space; null for a malformed reference. */
export function gridCell(ref: string): { x0: number; y0: number; x1: number; y1: number } | null {
  const m = REF.exec(ref.trim().toUpperCase());
  if (!m) return null;
  const col = GRID_COLS.indexOf(m[1]);
  const row = Number(m[2]) - 1;
  const cell = 1 / GRID_N;
  let x0 = col * cell;
  let y0 = row * cell;
  let size = cell;
  if (m[3]) {
    const d = Number(m[3]) - 1;
    const sc = d % 3;
    const sr = 2 - Math.floor(d / 3);
    size = cell / 3;
    x0 += sc * size;
    y0 += sr * size;
  }
  return { x0, y0, x1: x0 + size, y1: y0 + size };
}

/** Line positions (0..1), 11 values on each axis. */
export function gridLines(): { cols: number[]; rows: number[] } {
  const lines = Array.from({ length: GRID_N + 1 }, (_, i) => i / GRID_N);
  return { cols: lines, rows: [...lines] };
}

/** Centre of a cell reference, for "centre the map on D7". */
export function gridCentre(ref: string): Point | null {
  const c = gridCell(ref);
  return c ? { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 } : null;
}
