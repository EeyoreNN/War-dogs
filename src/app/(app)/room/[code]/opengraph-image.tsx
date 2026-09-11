import { OG_CONTENT_TYPE, OG_PRESETS, OG_SIZE, renderOg } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = OG_PRESETS.room.alt;
export const size = { width: OG_SIZE.width, height: OG_SIZE.height };
export const contentType = OG_CONTENT_TYPE;

// Codes are secrets (§1): the room image is generic and ignores `params`.
export default function Image() {
  return renderOg(OG_PRESETS.room);
}
