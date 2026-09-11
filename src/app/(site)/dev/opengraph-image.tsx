import { OG_CONTENT_TYPE, OG_PRESETS, OG_SIZE, renderOg } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = OG_PRESETS.dev.alt;
export const size = { width: OG_SIZE.width, height: OG_SIZE.height };
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOg(OG_PRESETS.dev);
}
