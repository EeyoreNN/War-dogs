/**
 * Canvas renderer for a TerrainModel: the same visual contract as `draw-svg.ts` (§3.7), with a
 * real hillshade from the heightfield. Browser only; nothing here touches the DOM at import time.
 */
import type { Point, Rect } from "../geo";
import { sampleGrid, type Grid } from "./geometry";
import { biomePalette, hexToRgb, mix, type BiomePalette } from "./palette";
import { STYLE, blockEdge, casingColour, levelTint } from "./draw-svg";
import type { Settlement, TerrainModel } from "./types";

/** Any 2D context: a CanvasRenderingContext2D or an OffscreenCanvasRenderingContext2D. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const LIGHT = { x: -0.62, y: -0.62, z: 0.48 }; // from the north-west, low

/** Per-cell hillshade in [0, 1] (0.5 = flat), from central differences on the heightfield. */
function shadeGrid(height: Grid): Grid {
  const r = height.res;
  const d = height.data;
  const out = new Float32Array(r * r);
  const scale = r * 0.55; // exaggerate relief a little
  for (let j = 0; j < r; j++) {
    for (let i = 0; i < r; i++) {
      const x0 = d[j * r + Math.max(0, i - 1)];
      const x1 = d[j * r + Math.min(r - 1, i + 1)];
      const y0 = d[Math.max(0, j - 1) * r + i];
      const y1 = d[Math.min(r - 1, j + 1) * r + i];
      const nx = -(x1 - x0) * scale;
      const ny = -(y1 - y0) * scale;
      const len = Math.hypot(nx, ny, 1);
      const dot = (nx * LIGHT.x + ny * LIGHT.y + LIGHT.z) / len;
      out[j * r + i] = Math.max(0, Math.min(1, dot / LIGHT.z / 2));
    }
  }
  return { data: out, res: r };
}

/** Hypsometric band tints, quantised like the SVG bands, as RGB triples per 0.05 step. */
function bandTints(p: BiomePalette): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k <= 20; k++) out.push(hexToRgb(levelTint(p, k * 0.05)));
  return out;
}

function paintGround(ctx: Ctx2D, model: TerrainModel, size: number, p: BiomePalette): void {
  const height: Grid = { data: model.height, res: model.res };
  const shade = shadeGrid(height);
  const tints = bandTints(p);
  const img = ctx.createImageData(size, size);
  const px = img.data;
  const sea = model.sea;
  const lowest = sea === null ? 0 : sea;
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const h = sampleGrid(height, u, v);
      const band = Math.max(0, Math.min(20, Math.floor(Math.max(h, lowest) / 0.05)));
      const t = tints[band];
      const s = sampleGrid(shade, u, v);
      const l = 1 + (s - 0.5) * 2 * STYLE.shade * 1.6;
      const o = (y * size + x) * 4;
      px[o] = Math.min(255, t[0] * l);
      px[o + 1] = Math.min(255, t[1] * l);
      px[o + 2] = Math.min(255, t[2] * l);
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function tracePath(
  ctx: Ctx2D,
  rings: readonly (readonly Point[])[],
  size: number,
  closed: boolean,
): void {
  ctx.beginPath();
  for (const ring of rings) {
    if (ring.length < 2) continue;
    ctx.moveTo(ring[0].x * size, ring[0].y * size);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i].x * size, ring[i].y * size);
    if (closed) ctx.closePath();
  }
}

function strokeRings(
  ctx: Ctx2D,
  rings: readonly (readonly Point[])[],
  size: number,
  o: { colour: string; alpha: number; width: number; dash?: number[]; closed?: boolean },
): void {
  if (!rings.length) return;
  tracePath(ctx, rings, size, o.closed ?? false);
  ctx.globalAlpha = o.alpha;
  ctx.strokeStyle = o.colour;
  ctx.lineWidth = o.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(o.dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function fillRings(
  ctx: Ctx2D,
  rings: readonly (readonly Point[])[],
  size: number,
  style: string | CanvasPattern,
  alpha: number,
): void {
  if (!rings.length) return;
  tracePath(ctx, rings, size, true);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style;
  ctx.fill("evenodd");
  ctx.globalAlpha = 1;
}

function drawBlock(ctx: Ctx2D, b: Rect, size: number): void {
  const w = b.w * size;
  const h = b.h * size;
  ctx.save();
  ctx.translate((b.x + b.w / 2) * size, (b.y + b.h / 2) * size);
  ctx.rotate(b.rot);
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSettlement(ctx: Ctx2D, s: Settlement, size: number, k: number, p: BiomePalette): void {
  const edge = blockEdge(p);
  ctx.lineWidth = Math.max(0.4, STYLE.blockEdge * k);
  ctx.setLineDash([]);
  if (s.kind === "water-works") {
    for (const b of s.blocks) {
      const r = (Math.min(b.w, b.h) / 2) * size;
      const cx = (b.x + b.w / 2) * size;
      const cy = (b.y + b.h / 2) * size;
      ctx.fillStyle = p.block;
      ctx.strokeStyle = edge;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (s.kind === "quarry") {
    ctx.fillStyle = p.high;
    ctx.strokeStyle = edge;
    ctx.globalAlpha = 0.75;
    ctx.setLineDash([3 * k, 2 * k]);
    for (const b of s.blocks) drawBlock(ctx, b, size);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = p.block;
  ctx.strokeStyle = edge;
  for (const b of s.blocks) drawBlock(ctx, b, size);
}

function drawPois(ctx: Ctx2D, model: TerrainModel, size: number, k: number, p: BiomePalette): void {
  const s = Math.max(2.5, 5 * k);
  ctx.strokeStyle = p.label;
  ctx.fillStyle = p.label;
  ctx.lineWidth = Math.max(0.6, 1.2 * k);
  ctx.setLineDash([]);
  for (const poi of model.pois) {
    const x = poi.at.x * size;
    const y = poi.at.y * size;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    switch (poi.kind) {
      case "objective":
        ctx.arc(x, y, s * 1.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
        ctx.globalAlpha = 0.85;
        ctx.fill();
        break;
      case "town":
        ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
        ctx.globalAlpha = 0.8;
        ctx.fill();
        break;
      case "industry":
        ctx.rect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4);
        ctx.stroke();
        break;
      case "water":
        ctx.moveTo(x - s, y);
        ctx.quadraticCurveTo(x - s / 2, y - s * 0.8, x, y);
        ctx.quadraticCurveTo(x + s / 2, y + s * 0.8, x + s, y);
        ctx.stroke();
        break;
      default:
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y + s * 0.7);
        ctx.lineTo(x - s, y + s * 0.7);
        ctx.closePath();
        ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawLabels(
  ctx: Ctx2D,
  model: TerrainModel,
  size: number,
  k: number,
  p: BiomePalette,
): void {
  const fs = Math.max(7, STYLE.label * k);
  ctx.font = `${fs}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = fs * 0.25;
  ctx.strokeStyle = p.low;
  ctx.fillStyle = p.label;
  const seen = new Set<string>();
  const draw = (name: string, x: number, y: number) => {
    const text = name.toUpperCase();
    const cx = Math.min(size - fs * 4, Math.max(fs * 4, x));
    ctx.globalAlpha = 0.6;
    ctx.strokeText(text, cx, y);
    ctx.globalAlpha = 0.7;
    ctx.fillText(text, cx, y);
  };
  for (const s of model.settlements) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    let maxY = s.center.y;
    for (const b of s.blocks) maxY = Math.max(maxY, b.y + b.h);
    draw(s.name, s.center.x * size, Math.min(maxY, s.center.y + 0.03) * size + fs * 1.4);
  }
  for (const poi of model.pois) {
    if (poi.kind === "objective" || seen.has(poi.name)) continue;
    seen.add(poi.name);
    draw(poi.name, poi.at.x * size, poi.at.y * size + fs * 1.9);
  }
  ctx.globalAlpha = 1;
}

/** Stipple pattern for woodland; null when the context cannot make one (tests, old engines). */
function woodPattern(ctx: Ctx2D, k: number, colour: string): CanvasPattern | null {
  const cell = Math.max(3, Math.round(5 * k));
  try {
    const tile =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(cell, cell)
        : typeof document !== "undefined"
          ? document.createElement("canvas")
          : null;
    if (!tile) return null;
    tile.width = cell;
    tile.height = cell;
    const tctx = tile.getContext("2d") as Ctx2D | null;
    if (!tctx) return null;
    tctx.fillStyle = colour;
    tctx.beginPath();
    tctx.arc(cell / 2, cell / 2, Math.max(0.6, 1.05 * k), 0, Math.PI * 2);
    tctx.fill();
    return ctx.createPattern(tile as CanvasImageSource, "repeat");
  } catch {
    return null;
  }
}

/** Draw the whole terrain into a `size × size` context. Same look as `terrainToSvg` at "full". */
export function drawTerrain(ctx: Ctx2D, model: TerrainModel, size: number): void {
  const p = biomePalette(model.spec.biome);
  const k = size / 1024;
  const w = (v: number) => Math.max(0.5, v * k);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  paintGround(ctx, model, size, p);

  // Field patchwork.
  if (model.fields.length) {
    fillRings(
      ctx,
      model.fields.filter((_, i) => i % 2 === 0),
      size,
      p.field,
      STYLE.fieldAlpha,
    );
    fillRings(
      ctx,
      model.fields.filter((_, i) => i % 2 === 1),
      size,
      p.field,
      STYLE.fieldAlpha * 1.8,
    );
    strokeRings(ctx, model.fields, size, {
      colour: p.field,
      alpha: 0.25,
      width: w(0.6),
      closed: true,
    });
  }
  // Woods.
  if (model.woods.length) {
    fillRings(ctx, model.woods, size, p.wood, STYLE.woodAlpha);
    const pattern = woodPattern(ctx, k, p.wood);
    if (pattern) fillRings(ctx, model.woods, size, pattern, 0.4);
  }
  // Contours.
  const plain = model.contours.filter((c) => !c.index).map((c) => c.path);
  const index = model.contours.filter((c) => c.index).map((c) => c.path);
  strokeRings(ctx, plain, size, {
    colour: p.contour,
    alpha: STYLE.contourAlpha,
    width: w(STYLE.contour),
    closed: true,
  });
  strokeRings(ctx, index, size, {
    colour: p.contour,
    alpha: STYLE.indexAlpha,
    width: w(STYLE.contour * 1.4),
    closed: true,
  });
  // Water.
  strokeRings(ctx, model.rivers, size, {
    colour: p.water,
    alpha: STYLE.riverAlpha,
    width: w(STYLE.river),
  });
  if (model.water.length) {
    fillRings(ctx, model.water, size, p.water, 1);
    strokeRings(ctx, model.water, size, {
      colour: mix(p.water, "#ffffff", 0.35),
      alpha: 0.5,
      width: w(1),
      closed: true,
    });
  }
  // Roads.
  const casing = casingColour(p);
  const rails = model.roads.filter((r) => r.kind === "rail").map((r) => r.path);
  const tracks = model.roads.filter((r) => r.kind === "track").map((r) => r.path);
  const mains = model.roads.filter((r) => r.kind === "main").map((r) => r.path);
  strokeRings(ctx, rails, size, { colour: casing, alpha: 0.8, width: w(STYLE.rail) });
  strokeRings(ctx, rails, size, {
    colour: casing,
    alpha: 0.8,
    width: w(STYLE.railTick),
    dash: [w(1.2), w(4.8)],
  });
  strokeRings(ctx, tracks, size, {
    colour: p.road,
    alpha: STYLE.roadAlpha,
    width: w(STYLE.track),
    dash: [w(4), w(3)],
  });
  strokeRings(ctx, mains, size, {
    colour: casing,
    alpha: 0.7,
    width: w(STYLE.mainRoad + STYLE.mainCasing * 2),
  });
  strokeRings(ctx, mains, size, {
    colour: p.road,
    alpha: STYLE.roadAlpha,
    width: w(STYLE.mainRoad),
  });
  // Settlements and POIs.
  for (const s of model.settlements) drawSettlement(ctx, s, size, k, p);
  drawPois(ctx, model, size, k, p);
  // Vignette.
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.35,
    size / 2,
    size / 2,
    size * 0.72,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${STYLE.vignette * 2})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Labels.
  if (size > 200) drawLabels(ctx, model, size, k, p);
  ctx.restore();
}

const bitmaps = new Map<string, Promise<ImageBitmap>>();

/**
 * The terrain as an ImageBitmap, drawn once per (map, size) and memoised. Uses OffscreenCanvas
 * when available, else a detached `<canvas>`.
 */
export function terrainBitmap(model: TerrainModel, size: number): Promise<ImageBitmap> {
  const key = `${model.spec.seed}:${size}`;
  const hit = bitmaps.get(key);
  if (hit) return hit;
  const promise = (async () => {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d") as Ctx2D | null;
    if (!ctx) throw new Error("terrainBitmap: no 2d context");
    drawTerrain(ctx, model, size);
    return createImageBitmap(canvas as ImageBitmapSource);
  })();
  bitmaps.set(key, promise);
  promise.catch(() => bitmaps.delete(key));
  return promise;
}

/** Test hook: forget memoised bitmaps. */
export function clearBitmapCache(): void {
  bitmaps.clear();
}
