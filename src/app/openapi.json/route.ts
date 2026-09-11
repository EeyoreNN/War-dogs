import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The OpenAPI document, byte-for-byte as committed (§3.14). Static; cached for an hour. */
export async function GET() {
  const body = await readFile(join(process.cwd(), "src/content/openapi.json"));
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
