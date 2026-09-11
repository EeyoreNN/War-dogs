import { z } from "zod";
import { terrainToSvg } from "@/lib/terrain/draw-svg";
import { mapModel } from "@/lib/terrain/generate";
import { CONTROL_ZONE_IDS, MAP_IDS, type MapId } from "@/lib/terrain/types";

/**
 * GET /terrain/<map>.svg — the procedural terrain by URL (§3.7). Dynamic (it reads the query),
 * immutable-cached: `terrainUrl` carries `v=site.version`, so a deploy busts the CDN copy.
 */
export const runtime = "nodejs";

const FILE = /^(zestafona|bakurani|ozeti)\.svg$/;

const Query = z.object({
  size: z.enum(["320", "640", "1024"]).default("1024"),
  zone: z.enum(CONTROL_ZONE_IDS).default("none"),
  grid: z.enum(["0", "1"]).default("0"),
  labels: z.enum(["0", "1"]).default("1"),
});

export async function GET(
  request: Request,
  ctx: RouteContext<"/terrain/[file]">,
): Promise<Response> {
  const { file } = await ctx.params;
  const match = FILE.exec(file);
  if (!match) return new Response("Not found", { status: 404 });
  const id = match[1] as MapId;
  if (!MAP_IDS.includes(id)) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const key of ["size", "zone", "grid", "labels"]) {
    const v = url.searchParams.get(key);
    if (v !== null) raw[key] = v;
  }
  const parsed = Query.safeParse(raw);
  if (!parsed.success) return new Response("Not found", { status: 404 });
  const q = parsed.data;

  const size = Number(q.size);
  const svg = terrainToSvg(mapModel(id), {
    size,
    zone: q.zone,
    grid: q.grid === "1",
    labels: q.labels === "1",
    detail: size <= 400 ? "thumb" : "full",
  });
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(Buffer.byteLength(svg)),
    },
  });
}
