export const MARK_VIEWBOX = "0 0 64 64";
export const MARK_PLATE = { x: 4, y: 4, w: 56, h: 56, rx: 8 };
export const MARK_CHEVRON = "M16 40 L32 18 L48 40";
export const MARK_PIN = { cx: 32, cy: 40, r: 5, core: 1.5 };
export const MARK_TICKS: [number, number][] = [[12, 50], [52, 50]];

/** String SVG of the mark for OG images and icon routes (no React). Colours are literal strings. */
export function markSvg(opts: {
  size: number; plate: string; plateStroke: string; stroke: string; accent: string; core: string;
  ticks: string | null; chevronWidth?: number;
}): string {
  const { size, plate, plateStroke, stroke, accent, core, ticks, chevronWidth = 6 } = opts;
  const tickMarks = ticks
    ? MARK_TICKS.map(([x, y]) => `<rect x="${x - 1}" y="${y - 1}" width="2" height="2" fill="${ticks}"/>`).join("")
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}">` +
    `<rect x="${MARK_PLATE.x}" y="${MARK_PLATE.y}" width="${MARK_PLATE.w}" height="${MARK_PLATE.h}" rx="${MARK_PLATE.rx}" fill="${plate}" stroke="${plateStroke}" stroke-width="2"/>` +
    `<path d="${MARK_CHEVRON}" fill="none" stroke="${stroke}" stroke-width="${chevronWidth}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${MARK_PIN.cx}" cy="${MARK_PIN.cy}" r="${MARK_PIN.r}" fill="${accent}"/>` +
    `<circle cx="${MARK_PIN.cx}" cy="${MARK_PIN.cy}" r="${MARK_PIN.core}" fill="${core}"/>` +
    tickMarks +
    `</svg>`
  );
}
