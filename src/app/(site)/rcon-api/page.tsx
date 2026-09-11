import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DocsShell } from "@/components/docs/DocsShell";
import { ConsoleLoader } from "@/components/console/ConsoleLoader";
import { getSpec } from "@/lib/openapi/match";

const description =
  "Browse every RCON endpoint with live examples. Try it against the in-browser simulator or your own server.";

export const metadata: Metadata = {
  title: "API Console",
  description,
  alternates: { canonical: "/rcon-api" },
};

/**
 * `/rcon-api` (§4.9): the docs shell around the client console. Static shell; the console reads
 * `?endpoint=` after mount. The config text the simulator's `/v1/config` endpoints serve is the
 * starter template read here with `fs` so the client bundle never carries it twice.
 */
export default async function ApiConsolePage() {
  const { info } = getSpec();
  const configText = await readFile(join(process.cwd(), "src/content/ServerSettings.ini"), "utf8");
  return (
    <DocsShell
      eyebrow="Dev hub"
      unofficialLine="Community tools and references. Not affiliated with the Wardogs developers."
      title="API Console"
      intro={
        <p>
          Every endpoint in the spec, with a form, a live request preview and a response. Try it
          against the simulator in this tab, or against your own server.
        </p>
      }
      toc={[]}
      updated={info.updated}
      version={info.version}
    >
      <ConsoleLoader configText={configText} />
    </DocsShell>
  );
}
