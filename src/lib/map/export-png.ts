// Browser-only export helpers (§3.4). The map SVG must carry presentation attributes (§4.3.2):
// elements marked data-export="skip" (cursor, pings, selection, editors, help) are dropped and
// the world group marked data-export="world" gets its viewport transform reset so the whole map
// renders at MAP_PX.
import { MAP_PX } from "./types";

export const EXPORT_LEGEND_HEIGHT = 56;

export function exportSvg(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-export="skip"]').forEach((el) => el.remove());
  clone.querySelectorAll('[data-export="world"]').forEach((el) => el.removeAttribute("transform"));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("viewBox", `0 0 ${MAP_PX} ${MAP_PX}`);
  clone.setAttribute("width", String(MAP_PX));
  clone.setAttribute("height", String(MAP_PX));
  clone.removeAttribute("style");
  clone.removeAttribute("class");
  if (process.env.NODE_ENV !== "production") {
    const offender = clone.querySelector(
      "path[class], circle[class], rect[class], line[class], polyline[class], polygon[class], ellipse[class], text[class], use[class]",
    );
    if (offender) {
      throw new Error(
        `exportSvg: <${offender.tagName}> carries class="${offender.getAttribute("class")}"; map elements must use presentation attributes`,
      );
    }
  }
  return new XMLSerializer().serializeToString(clone);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("exportPng: the map SVG could not be rasterised"));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("exportPng: toBlob failed"))),
      "image/png",
    );
  });
}

/**
 * Terrain, then the serialised map SVG, then a 56 px legend strip bottom-left. Text inside the
 * raster falls back to the system monospace (web fonts are not embedded); accepted.
 */
export async function exportPng(
  svgEl: SVGSVGElement,
  terrain: HTMLCanvasElement | ImageBitmap,
  legend: { code: string; team: string; map: string; zone: string; date: string },
  size = MAP_PX,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("exportPng: no 2d context");
  ctx.fillStyle = "#0b0b0a";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(terrain, 0, 0, size, size);

  const svg = exportSvg(svgEl);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await loadImage(url);
    ctx.drawImage(img, 0, 0, size, size);
  } finally {
    URL.revokeObjectURL(url);
  }

  const h = Math.round((EXPORT_LEGEND_HEIGHT * size) / MAP_PX);
  const pad = Math.round(h * 0.28);
  const font = Math.max(10, Math.round(h * 0.34));
  ctx.font = `${font}px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;
  const line1 = `WAR ROOM ${legend.code} · ${legend.team.toUpperCase()} · ${legend.map.toUpperCase()} · ${legend.zone.toUpperCase()} ZONE`;
  const line2 = `${legend.date} · wardogs.tech · schematic map — layout is approximate`;
  const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + pad * 2;
  ctx.fillStyle = "rgba(11, 11, 10, 0.82)";
  ctx.fillRect(0, size - h, w, h);
  ctx.fillStyle = "#f1a52a";
  ctx.textBaseline = "top";
  ctx.fillText(line1, pad, size - h + pad * 0.6);
  ctx.fillStyle = "#c9c3b4";
  ctx.fillText(line2, pad, size - h + pad * 0.6 + font * 1.35);
  return toBlob(canvas);
}
