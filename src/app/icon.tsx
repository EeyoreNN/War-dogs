import { ImageResponse } from "next/og";
import { markSvg } from "@/lib/brand/mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/* 20 % padding each side keeps the plate inside the maskable safe zone. */
const MARK = size.width * 0.6;

export default function Icon() {
  const svg = markSvg({
    size: MARK,
    plate: "#1e1c18",
    plateStroke: "#4a453c",
    stroke: "#f1ebdd",
    accent: "#ffa028",
    core: "#141311",
    ticks: "#6f685d",
  });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#141311",
      }}
    >
      <img
        src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
        width={MARK}
        height={MARK}
        alt=""
      />
    </div>,
    size,
  );
}
