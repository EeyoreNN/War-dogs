import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The starter config as a download (§3.14): text/plain with an attachment disposition. */
export async function GET() {
  const body = await readFile(join(process.cwd(), "src/content/ServerSettings.ini"));
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ServerSettings.ini"',
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
