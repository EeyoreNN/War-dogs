/**
 * String-only SVG renderer for a TerrainModel. No DOM, no React: safe in the OG runtime and in
 * route handlers. The canvas renderer (`draw-canvas.ts`) follows the same visual contract (§3.7).
 */
import type { Point, Rect } from "../geo";
import { contourLines } from "./contours";
import { downsample } from "./geometry";
import { ACCENT, ACCENT_INK, biomePalette, mix, type BiomePalette } from "./palette";
import type { Contour, ControlZoneId, Poi, Settlement, TerrainModel } from "./types";

export { biomePalette };

export interface SvgOptions {
  size: number;
  labels?: boolean;
  grid?: boolean;
  zone?: ControlZoneId;
  crop?: { x: number; y: number; w: number; h: number };
  background?: boolean;
  /** "thumb" (default when size ≤ 400): contours from a res-64 downsample, RDP 0.002, no woods stipple, no field patchwork, no labels. "full": RDP 0.0008, everything. */
  detail?: "thumb" | "full";
}

/** Contour extraction tolerances per detail level (map units). */
export const THUMB_EPS = 0.002;
export const THUMB_RES = 64;

/** Line widths and glyph sizes at size 1024; every renderer scales them by `size / 1024`. */
export const STYLE = {
  contour: 1,
  contourAlpha: 0.1,
  indexAlpha: 0.18,
  river: 6,
  riverAlpha: 0.8,
  mainRoad: 3,
  mainCasing: 1,
  roadAlpha: 0.6,
  track: 1.5,
  rail: 2,
  railTick: 6,
  blockEdge: 0.5,
  label: 10,
  gridLabel: 9,
  zoneRing: 2,
  woodAlpha: 0.12,
  fieldAlpha: 0.1,
  vignette: 0.04,
  shade: 0.08,
} as const;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GRID_LETTERS = "ABCDEFGHIJ";

/** Hypsometric tint for a contour level (0.05–0.95 → low → high). */
export function levelTint(p: BiomePalette, level: number): string {
  return mix(p.low, p.high, Math.max(0, Math.min(1, (level - 0.05) / 0.9)));
}

/** Darker casing colour for main roads. */
export const casingColour = (p: BiomePalette): string => mix(p.road, "#000000", 0.45);
/** Lighter block edge. */
export const blockEdge = (p: BiomePalette): string => mix(p.block, "#ffffff", 0.5);

/** Compact path data: absolute integers (or one decimal below 320 px), relative segments. */
function pathData(rings: readonly (readonly Point[])[], size: number, closed: boolean): string {
  const dec = size < 320 ? 10 : 1;
  const q = (v: number) => Math.round(v * size * dec) / dec;
  const num = (v: number) => (dec === 1 ? String(v) : String(Math.round(v * 10) / 10));
  let d = "";
  for (const ring of rings) {
    if (ring.length < 2) continue;
    let px = q(ring[0].x);
    let py = q(ring[0].y);
    d += `M${num(px)} ${num(py)}`;
    for (let i = 1; i < ring.length; i++) {
      const x = q(ring[i].x);
      const y = q(ring[i].y);
      const dx = Math.round((x - px) * dec) / dec;
      const dy = Math.round((y - py) * dec) / dec;
      if (dx === 0 && dy === 0) continue;
      if (dy === 0) d += `h${num(dx)}`;
      else if (dx === 0) d += `v${num(dy)}`;
      else d += `l${num(dx)} ${num(dy)}`;
      px = x;
      py = y;
    }
    if (closed) d += "z";
  }
  return d;
}

function rectSvg(r: Rect, size: number, attrs: string): string {
  const x = r.x * size;
  const y = r.y * size;
  const w = r.w * size;
  const h = r.h * size;
  const f = (v: number) => Math.round(v * 10) / 10;
  const rot = r.rot
    ? ` transform="rotate(${f((r.rot * 180) / Math.PI)} ${f(x + w / 2)} ${f(y + h / 2)})"`
    : "";
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rot}${attrs}/>`;
}

/** Contours for the requested detail: the model's own at "full", a res-64 recompute at "thumb". */
export function contoursFor(model: TerrainModel, detail: "thumb" | "full"): Contour[] {
  if (detail === "full") return model.contours;
  return contourLines(
    downsample({ data: model.height, res: model.res }, THUMB_RES),
    model.sea,
    THUMB_EPS,
  );
}

function groupByLevel(contours: Contour[]): Map<number, { index: boolean; rings: Point[][] }> {
  const groups = new Map<number, { index: boolean; rings: Point[][] }>();
  for (const c of contours) {
    const g = groups.get(c.level);
    if (g) g.rings.push(c.path);
    else groups.set(c.level, { index: c.index, rings: [c.path] });
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

/** POI glyphs: original, tiny, mono-weight. Objective is a ringed dot; others are 5 px marks. */
function poiGlyph(poi: Poi, size: number, k: number, colour: string): string {
  const x = Math.round(poi.at.x * size * 10) / 10;
  const y = Math.round(poi.at.y * size * 10) / 10;
  const s = Math.max(2.5, 5 * k);
  const sw = Math.max(0.6, 1.2 * k);
  const common = `stroke="${colour}" stroke-width="${sw}" stroke-opacity="0.75" fill="none"`;
  switch (poi.kind) {
    case "objective":
      return `<circle cx="${x}" cy="${y}" r="${s * 1.6}" ${common}/><circle cx="${x}" cy="${y}" r="${s * 0.45}" fill="${colour}" fill-opacity="0.85"/>`;
    case "town":
      return `<circle cx="${x}" cy="${y}" r="${s * 0.7}" fill="${colour}" fill-opacity="0.8"/>`;
    case "industry":
      return `<rect x="${x - s * 0.7}" y="${y - s * 0.7}" width="${s * 1.4}" height="${s * 1.4}" ${common}/>`;
    case "water":
      return `<path d="M${x - s} ${y}q${s / 2} ${-s * 0.8} ${s} 0t${s} 0" ${common}/>`;
    default:
      return `<path d="M${x} ${y - s}l${s} ${s * 1.7}h${-s * 2}z" ${common}/>`;
  }
}

/** Complete `<svg>` string, viewBox `0 0 size size` (or the crop), per the §3.7 visual contract. */
export function terrainToSvg(model: TerrainModel, opts: SvgOptions): string {
  const size = opts.size;
  const detail = opts.detail ?? (size <= 400 ? "thumb" : "full");
  const full = detail === "full";
  const labels = opts.labels !== false && full && size > 200;
  const k = size / 1024;
  const p = biomePalette(model.spec.biome);
  const parts: string[] = [];
  const f = (v: number) => Math.round(v * 10) / 10;
  const w = (v: number) => f(Math.max(0.5, v * k));

  const crop = opts.crop;
  const viewBox = crop
    ? `${f(crop.x * size)} ${f(crop.y * size)} ${f(crop.w * size)} ${f(crop.h * size)}`
    : `0 0 ${size} ${size}`;
  const outW = size;
  const outH = crop ? Math.round((size * crop.h) / crop.w) : size;
  const uid = `t${model.spec.seed.toString(36)}`;

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outW}" height="${outH}" viewBox="${viewBox}" role="img" aria-label="Terrain">`,
  );
  // Defs: contour paths (used four times each), woods stipple, vignette.
  const groups = groupByLevel(contoursFor(model, detail));
  const defs: string[] = [];
  let n = 0;
  const levelIds: { id: string; level: number; index: boolean }[] = [];
  for (const [level, g] of groups) {
    const id = `${uid}c${n++}`;
    defs.push(`<path id="${id}" d="${pathData(g.rings, size, true)}"/>`);
    levelIds.push({ id, level, index: g.index });
  }
  if (full && model.woods.length) {
    const cell = f(Math.max(3, 5 * k));
    defs.push(
      `<pattern id="${uid}w" patternUnits="userSpaceOnUse" width="${cell}" height="${cell}"><circle cx="${f(cell / 2)}" cy="${f(cell / 2)}" r="${f(Math.max(0.6, 1.05 * k))}" fill="${p.wood}"/></pattern>`,
    );
  }
  defs.push(
    `<radialGradient id="${uid}v" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${STYLE.vignette * 2}"/></radialGradient>`,
  );
  parts.push(`<defs>${defs.join("")}</defs>`);

  // Ground.
  if (opts.background !== false)
    parts.push(`<rect width="${size}" height="${size}" fill="${p.low}"/>`);

  // Hypsometric bands with a NW light: shadow copy to the SE, highlight copy to the NW, then the
  // band itself; the same path is stroked as the contour line afterwards.
  const shift = f(Math.max(0.8, 1.8 * k));
  for (const { id, level } of levelIds) {
    parts.push(
      `<use href="#${id}" fill="#000" fill-opacity="${STYLE.shade * 1.8}" fill-rule="evenodd" transform="translate(${shift} ${shift})"/>`,
      `<use href="#${id}" fill="#fff" fill-opacity="${STYLE.shade * 1.1}" fill-rule="evenodd" transform="translate(-${shift} -${shift})"/>`,
      `<use href="#${id}" fill="${levelTint(p, level)}" fill-rule="evenodd"/>`,
    );
  }

  // Field patchwork (full only): two tones so parcels read as separate fields.
  if (full && model.fields.length) {
    const even = model.fields.filter((_, i) => i % 2 === 0);
    const odd = model.fields.filter((_, i) => i % 2 === 1);
    parts.push(
      `<path d="${pathData(even, size, true)}" fill="${p.field}" fill-opacity="${STYLE.fieldAlpha}"/>`,
    );
    parts.push(
      `<path d="${pathData(odd, size, true)}" fill="${p.field}" fill-opacity="${STYLE.fieldAlpha * 1.8}"/>`,
    );
    parts.push(
      `<path d="${pathData(model.fields, size, true)}" fill="none" stroke="${p.field}" stroke-opacity="0.25" stroke-width="${w(0.6)}"/>`,
    );
  }

  // Woods: flat tint always; stipple at full detail.
  if (model.woods.length) {
    const d = pathData(model.woods, size, true);
    parts.push(
      `<path d="${d}" fill="${p.wood}" fill-opacity="${STYLE.woodAlpha * (full ? 1 : 1.6)}" fill-rule="evenodd"/>`,
    );
    if (full)
      parts.push(`<path d="${d}" fill="url(#${uid}w)" fill-opacity="0.4" fill-rule="evenodd"/>`);
  }

  // Contour lines.
  for (const { id, index } of levelIds) {
    parts.push(
      `<use href="#${id}" fill="none" stroke="${p.contour}" stroke-opacity="${index ? STYLE.indexAlpha : STYLE.contourAlpha}" stroke-width="${w(index ? STYLE.contour * 1.4 : STYLE.contour)}" stroke-linejoin="round"/>`,
    );
  }

  // Water: rivers under the sea/lakes so mouths sit clean.
  if (model.rivers.length) {
    parts.push(
      `<path d="${pathData(model.rivers, size, false)}" fill="none" stroke="${p.water}" stroke-opacity="${STYLE.riverAlpha}" stroke-width="${w(STYLE.river)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  if (model.water.length) {
    const d = pathData(model.water, size, true);
    parts.push(
      `<path d="${d}" fill="${p.water}" fill-rule="evenodd" stroke="${mix(p.water, "#ffffff", 0.35)}" stroke-opacity="0.5" stroke-width="${w(1)}"/>`,
    );
  }

  // Roads: rail, then tracks, then main roads with casing.
  const rails = model.roads.filter((r) => r.kind === "rail").map((r) => r.path);
  const tracks = model.roads.filter((r) => r.kind === "track").map((r) => r.path);
  const mains = model.roads.filter((r) => r.kind === "main").map((r) => r.path);
  const casing = casingColour(p);
  if (rails.length) {
    const d = pathData(rails, size, false);
    parts.push(
      `<path d="${d}" fill="none" stroke="${casing}" stroke-opacity="0.8" stroke-width="${w(STYLE.rail)}"/>`,
      `<path d="${d}" fill="none" stroke="${casing}" stroke-opacity="0.8" stroke-width="${w(STYLE.railTick)}" stroke-dasharray="${w(1.2)} ${w(4.8)}"/>`,
    );
  }
  if (tracks.length) {
    parts.push(
      `<path d="${pathData(tracks, size, false)}" fill="none" stroke="${p.road}" stroke-opacity="${STYLE.roadAlpha}" stroke-width="${w(STYLE.track)}" stroke-dasharray="${w(4)} ${w(3)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  if (mains.length) {
    const d = pathData(mains, size, false);
    parts.push(
      `<path d="${d}" fill="none" stroke="${casing}" stroke-opacity="0.7" stroke-width="${w(STYLE.mainRoad + STYLE.mainCasing * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="none" stroke="${p.road}" stroke-opacity="${STYLE.roadAlpha}" stroke-width="${w(STYLE.mainRoad)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }

  // Settlements.
  const edge = blockEdge(p);
  for (const s of model.settlements) parts.push(settlementSvg(s, size, k, p, edge));

  // POI glyphs.
  for (const poi of model.pois) parts.push(poiGlyph(poi, size, k, p.label));

  // Vignette.
  parts.push(`<rect width="${size}" height="${size}" fill="url(#${uid}v)"/>`);

  // Grid: 10 × 10, A–J across the top, 1–10 down the left.
  if (opts.grid) {
    const cell = size / 10;
    let d = "";
    for (let i = 1; i < 10; i++) d += `M${f(i * cell)} 0V${size}M0 ${f(i * cell)}H${size}`;
    parts.push(
      `<path d="${d}" stroke="rgba(255,255,255,0.08)" stroke-width="${w(1)}" fill="none"/>`,
    );
    const fs = f(Math.max(6, STYLE.gridLabel * k));
    const txt: string[] = [];
    for (let i = 0; i < 10; i++) {
      txt.push(
        `<text x="${f(i * cell + cell / 2)}" y="${f(fs * 1.3)}" text-anchor="middle">${GRID_LETTERS[i]}</text>`,
      );
      txt.push(
        `<text x="${f(fs * 0.5)}" y="${f(i * cell + cell / 2 + fs * 0.35)}">${i + 1}</text>`,
      );
    }
    parts.push(
      `<g font-family="JetBrains Mono, ui-monospace, Menlo, monospace" font-size="${fs}" fill="${p.label}" fill-opacity="0.55">${txt.join("")}</g>`,
    );
  }

  // Control zone.
  let zoneName: string | null = null;
  if (opts.zone && opts.zone !== "none") {
    const zone = model.zones.find((z) => z.id === opts.zone);
    if (zone) {
      zoneName = zone.name;
      const cx = f(zone.center.x * size);
      const cy = f(zone.center.y * size);
      const r = f(zone.radius * size);
      parts.push(
        `<path d="${pathData([zone.polygon], size, true)}" fill="${ACCENT}" fill-opacity="0.1"/>`,
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ACCENT}" stroke-width="${w(STYLE.zoneRing)}" stroke-dasharray="${w(6)} ${w(4)}"/>`,
      );
      const fs = f(Math.max(7, STYLE.label * k));
      const label = zone.name.toUpperCase();
      const chipW = f(label.length * fs * 0.66 + fs * 1.4);
      const chipH = f(fs * 1.7);
      const chipY = f(cy - r - chipH - fs * 0.6);
      parts.push(
        `<rect x="${f(cx - chipW / 2)}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${f(fs * 0.25)}" fill="${ACCENT}"/>`,
        `<text x="${cx}" y="${f(chipY + chipH * 0.68)}" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, Menlo, monospace" font-size="${fs}" font-weight="700" letter-spacing="${f(fs * 0.1)}" fill="${ACCENT_INK}">${esc(label)}</text>`,
      );
    }
  }

  // Labels last so nothing covers them.
  if (labels) parts.push(labelsSvg(model, size, k, p, zoneName));

  parts.push("</svg>");
  return parts.join("");
}

function settlementSvg(
  s: Settlement,
  size: number,
  k: number,
  p: BiomePalette,
  edge: string,
): string {
  const f = (v: number) => Math.round(v * 10) / 10;
  const sw = f(Math.max(0.4, STYLE.blockEdge * k));
  if (s.kind === "water-works") {
    return s.blocks
      .map((b) => {
        const r = (Math.min(b.w, b.h) / 2) * size;
        const cx = f((b.x + b.w / 2) * size);
        const cy = f((b.y + b.h / 2) * size);
        return `<circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="${p.block}" stroke="${edge}" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${f(r * 0.55)}" fill="none" stroke="${edge}" stroke-width="${sw}"/>`;
      })
      .join("");
  }
  if (s.kind === "quarry") {
    return s.blocks
      .map((b) =>
        rectSvg(
          b,
          size,
          ` fill="${p.high}" fill-opacity="0.75" stroke="${edge}" stroke-opacity="0.8" stroke-width="${sw}" stroke-dasharray="${f(3 * k)} ${f(2 * k)}"`,
        ),
      )
      .join("");
  }
  return s.blocks
    .map((b) => rectSvg(b, size, ` fill="${p.block}" stroke="${edge}" stroke-width="${sw}"`))
    .join("");
}

/**
 * Place names: mono 10 px at 70 %, uppercase, one per distinct name; the objective has no text and
 * the town under an active zone chip is not repeated. Labels that would collide slide to the next
 * free slot (below, above, then further below).
 */
function labelsSvg(
  model: TerrainModel,
  size: number,
  k: number,
  p: BiomePalette,
  skipName: string | null,
): string {
  const f = (v: number) => Math.round(v * 10) / 10;
  const fs = f(Math.max(7, STYLE.label * k));
  const seen = new Set<string>();
  const items: { at: Point; name: string; dy: number }[] = [];
  for (const s of model.settlements) {
    if (seen.has(s.name) || s.name === skipName) continue;
    seen.add(s.name);
    let maxY = s.center.y;
    for (const b of s.blocks) maxY = Math.max(maxY, b.y + b.h);
    items.push({
      at: { x: s.center.x, y: Math.min(maxY, s.center.y + 0.03) },
      name: s.name,
      dy: fs * 1.4,
    });
  }
  for (const poi of model.pois) {
    if (poi.kind === "objective" || seen.has(poi.name)) continue;
    seen.add(poi.name);
    items.push({ at: poi.at, name: poi.name, dy: fs * 1.9 });
  }
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const texts: string[] = [];
  for (const it of items) {
    const width = it.name.length * fs * 0.64 + fs * 0.4;
    const x = f(Math.min(size - width / 2, Math.max(width / 2, it.at.x * size)));
    const base = it.at.y * size;
    const candidates = [
      base + it.dy,
      base - it.dy + fs * 0.6,
      base + it.dy + fs * 1.3,
      base - it.dy - fs * 0.8,
    ];
    let y = candidates[0];
    for (const cand of candidates) {
      const box = { x0: x - width / 2, y0: cand - fs, x1: x + width / 2, y1: cand + fs * 0.3 };
      if (box.y0 < 0 || box.y1 > size) continue;
      const hit = placed.some(
        (b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
      );
      if (!hit) {
        y = cand;
        break;
      }
    }
    placed.push({ x0: x - width / 2, y0: y - fs, x1: x + width / 2, y1: y + fs * 0.3 });
    texts.push(`<text x="${x}" y="${f(y)}">${esc(it.name.toUpperCase())}</text>`);
  }
  return `<g font-family="JetBrains Mono, ui-monospace, Menlo, monospace" font-size="${fs}" letter-spacing="${f(fs * 0.08)}" text-anchor="middle" fill="${p.label}" fill-opacity="0.7" paint-order="stroke" stroke="${p.low}" stroke-opacity="0.6" stroke-width="${f(fs * 0.25)}" stroke-linejoin="round">${texts.join("")}</g>`;
}

/** Data URI for the OG renderer only — never inline this in server HTML (§3.7). */
export function terrainToDataUri(model: TerrainModel, opts: SvgOptions): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(terrainToSvg(model, opts));
}
