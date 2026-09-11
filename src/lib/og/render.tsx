/**
 * OG image renderer (§6.2). `renderOg(preset)` returns an `ImageResponse` for a 1200×630 card:
 * charcoal ground, the two-scale grid at 4 %, the brand contour rings, an optional terrain crop at
 * 40 % on the right, the lockup, a Saira 800 headline, an amber Barlow 500 strapline with rules
 * either side, and a 4 px amber bar on the bottom edge. Node runtime only (it reads the TTFs).
 */
import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { site } from "@/config/site";
import { CONTOUR_PATHS, CONTOUR_VIEWBOX } from "@/lib/brand/contours";
import { markSvg } from "@/lib/brand/mark";
import { terrainToDataUri } from "@/lib/terrain/draw-svg";
import { mapModel } from "@/lib/terrain/generate";
import { OG_SIZE, type OgPreset } from "./presets";

export { OG_CONTENT_TYPE, OG_PRESETS, OG_SIZE, type OgPreset, type OgPresetId } from "./presets";

const INK = "#141311";
const TEXT = "#f1ebdd";
const ACCENT = "#ffa028";

type Font = { name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" };

let fontCache: Font[] | null | undefined;

/** The two brand faces as TTF buffers, or null when they cannot be read (text-free fallback). */
export function loadOgFonts(): Font[] | null {
  if (fontCache !== undefined) return fontCache;
  try {
    // Literal paths so Vercel's file tracing bundles the TTFs (§6.2).
    const saira = readFileSync(
      join(process.cwd(), "src/assets/fonts/SairaCondensed-ExtraBold.ttf"),
    );
    const barlow = readFileSync(join(process.cwd(), "src/assets/fonts/Barlow-Medium.ttf"));
    fontCache = [
      { name: "Saira Condensed", data: toArrayBuffer(saira), weight: 800, style: "normal" },
      { name: "Barlow", data: toArrayBuffer(barlow), weight: 500, style: "normal" },
    ];
  } catch {
    fontCache = null;
  }
  return fontCache;
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Headline size: 128 px for short lines, shrinking so the widest line fits 1080 px. */
export function headlineSize(lines: readonly string[]): number {
  const widest = Math.max(1, ...lines.map((l) => l.length));
  return Math.round(Math.min(128, 1080 / (widest * 0.52)));
}

const grid = {
  backgroundImage:
    "linear-gradient(to right, rgba(241,235,221,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(241,235,221,0.04) 1px, transparent 1px)",
  backgroundSize: "80px 80px, 80px 80px",
} as const;

const fineGrid = {
  backgroundImage:
    "linear-gradient(to right, rgba(241,235,221,0.018) 1px, transparent 1px), linear-gradient(to bottom, rgba(241,235,221,0.018) 1px, transparent 1px)",
  backgroundSize: "16px 16px, 16px 16px",
} as const;

/** Build the card. Exported for tests; `renderOg` wraps it in an ImageResponse. */
export function ogElement(preset: OgPreset, fonts: Font[] | null): React.ReactElement {
  const text = fonts !== null;
  const mark = markSvg({
    size: 44,
    plate: "#1e1c18",
    plateStroke: "#4a453c",
    stroke: TEXT,
    accent: ACCENT,
    core: INK,
    ticks: "#6f685d",
  });
  const terrain = preset.terrain
    ? terrainToDataUri(mapModel(preset.terrain), {
        size: 630,
        detail: "thumb",
        labels: false,
        grid: false,
      })
    : null;
  const size = headlineSize(preset.headline);
  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: INK,
        color: TEXT,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          ...fineGrid,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          display: "flex",
          ...grid,
        }}
      />
      {terrain ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 630,
            height: 630,
            display: "flex",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- satori needs a plain img */}
          <img src={terrain} width={630} height={630} alt="" style={{ opacity: 0.4 }} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 630,
              height: 630,
              display: "flex",
              backgroundImage: `linear-gradient(to right, ${INK} 0%, rgba(20,19,17,0.55) 45%, rgba(20,19,17,0) 100%)`,
            }}
          />
        </div>
      ) : null}
      <svg
        viewBox={CONTOUR_VIEWBOX}
        width={1200}
        height={800}
        style={{ position: "absolute", top: -170, right: 0, opacity: 1 }}
        aria-hidden="true"
      >
        {CONTOUR_PATHS.map((d) => (
          <path key={d} d={d} fill="none" stroke={ACCENT} strokeOpacity={0.07} strokeWidth={1.5} />
        ))}
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- satori needs a plain img */}
        <img src={`data:image/svg+xml,${encodeURIComponent(mark)}`} width={44} height={44} alt="" />
        {text ? (
          <div
            style={{
              display: "flex",
              fontFamily: "Saira Condensed",
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: 1,
              lineHeight: 1,
            }}
          >
            <span style={{ color: TEXT }}>{site.shortName}</span>
            <span style={{ color: ACCENT }}>{site.tld}</span>
          </div>
        ) : null}
      </div>
      {text ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontFamily: "Saira Condensed",
            fontWeight: 800,
            fontSize: size,
            lineHeight: 0.9,
            letterSpacing: -1,
            textAlign: "center",
            color: TEXT,
            maxWidth: 1100,
          }}
        >
          {preset.headline.slice(0, 3).map((line) => (
            <div key={line} style={{ display: "flex" }}>
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          {preset.headline.slice(0, 3).map((line, i) => (
            <div
              key={line}
              style={{
                display: "flex",
                width: 560 - i * 60,
                height: 56,
                background: TEXT,
                opacity: 0.85,
              }}
            />
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 40 }}>
        <div style={{ display: "flex", width: 60, height: 3, background: ACCENT }} />
        {text ? (
          <div
            style={{
              display: "flex",
              fontFamily: "Barlow",
              fontWeight: 500,
              fontSize: 30,
              letterSpacing: 1,
              color: ACCENT,
              lineHeight: 1,
            }}
          >
            {preset.strapline}
          </div>
        ) : null}
        <div style={{ display: "flex", width: 60, height: 3, background: ACCENT }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          display: "flex",
          background: ACCENT,
        }}
      />
    </div>
  );
}

/** The image response for a preset. Text falls back to a mark-and-rules composition without fonts. */
export function renderOg(preset: OgPreset): ImageResponse {
  const fonts = loadOgFonts();
  return new ImageResponse(ogElement(preset, fonts), {
    ...OG_SIZE,
    fonts: fonts ?? undefined,
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
