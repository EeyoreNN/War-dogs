import { ImageResponse } from "next/og";
import { markSvg } from "@/lib/brand/mark";

export const runtime = "nodejs";
export const alt = "Server admin in the same Discord — live players, match history, bans with evidence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
 * Phase 1 stand-in for WP2's `renderOg({ headline, strapline, terrain: "bakurani" })` (§6.2):
 * the same composition — charcoal ground, the two-scale grid, the lockup, a three-line
 * headline, the amber strapline with rules, a 4 px amber bar — without the terrain crop and
 * the committed TTFs (satori falls back to its bundled face). Swapped for `renderOg` in Phase 2.
 */
export default function Image() {
  const mark = markSvg({
    size: 44,
    plate: "#1e1c18",
    plateStroke: "#4a453c",
    stroke: "#f1ebdd",
    accent: "#ffa028",
    core: "#141311",
    ticks: "#6f685d",
  });
  const grid =
    "linear-gradient(to right, rgba(241,235,221,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(241,235,221,0.04) 1px, transparent 1px)";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#141311",
        backgroundImage: grid,
        backgroundSize: "80px 80px",
        color: "#f1ebdd",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
        <img src={`data:image/svg+xml,${encodeURIComponent(mark)}`} width={44} height={44} alt="" />
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 0 }}>
          <span>WARDOGS</span>
          <span style={{ color: "#ffa028" }}>.TECH</span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontSize: 112,
          fontWeight: 800,
          lineHeight: 0.9,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        <span>Server admin</span>
        <span>in the same Discord</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 40 }}>
        <div style={{ width: 60, height: 2, background: "#ffa028" }} />
        <span style={{ fontSize: 30, fontWeight: 500, color: "#ffa028", letterSpacing: 2 }}>
          LIVE PLAYERS. MATCH HISTORY. BANS WITH EVIDENCE.
        </span>
        <div style={{ width: 60, height: 2, background: "#ffa028" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "#ffa028" }} />
    </div>,
    size,
  );
}
