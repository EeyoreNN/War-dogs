import { ImageResponse } from "next/og";
import { markSvg } from "@/lib/brand/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/* Amber plate, dark glyph; iOS rounds the corners itself. */
export default function AppleIcon() {
  const svg = markSvg({
    size: size.width,
    plate: "#ffa028",
    plateStroke: "#ffa028",
    stroke: "#141311",
    accent: "#141311",
    core: "#ffa028",
    ticks: "#141311",
  });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffa028",
      }}
    >
      <img
        src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
        width={size.width}
        height={size.height}
        alt=""
      />
    </div>,
    size,
  );
}
