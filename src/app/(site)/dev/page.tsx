import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ArrowDownToLine } from "lucide-react";
import { DocSection, DocsShell } from "@/components/docs/DocsShell";
import { ConfigValidator } from "@/components/docs/ConfigValidator";
import { IniViewer } from "@/components/docs/IniViewer";
import { Callout } from "@/components/ui/callout";
import { CardBody, CardEyebrow, CardTitle, cardClasses, LinkCard } from "@/components/ui/card";
import { JsonLd } from "@/components/site/json-ld";
import { DEV_CARDS } from "@/content/dev/dev-hub";
import { docJsonLd } from "@/content/dev/json-ld";
import { cn } from "@/lib/utils";

const description = "Everything for running a Wardogs dedicated server in one place.";

export const metadata: Metadata = {
  title: "Run your server",
  description,
  alternates: { canonical: "/dev" },
};

export default async function DevHubPage() {
  const template = await readFile(join(process.cwd(), "src/content/ServerSettings.ini"), "utf8");
  return (
    <>
      {docJsonLd({ path: "/dev", title: "Run your server", description }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <DocsShell
        eyebrow="Dev hub"
        unofficialLine="Community tools and references. Not affiliated with the Wardogs developers."
        title="Run your server"
        intro={
          <p>
            Everything for running a Wardogs dedicated server in one place: the RCON API, an
            interactive console, the spec to build against, and a config file to start from.
          </p>
        }
        toc={[]}
      >
        <section aria-label="Tools and references" className="not-prose">
          <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
            {DEV_CARDS.map((card) => (
              <li key={card.href} className="flex">
                {card.download ? (
                  <a
                    href={card.href}
                    download
                    className={cn(cardClasses("link"), "relative block w-full p-6 no-underline")}
                  >
                    <ArrowDownToLine
                      aria-hidden="true"
                      size={18}
                      className="absolute top-5 right-5 text-fg-faint transition-colors duration-200 group-focus-within:text-accent group-hover:text-accent"
                    />
                    <CardEyebrow>{card.eyebrow}</CardEyebrow>
                    <CardTitle className="mt-3">{card.title}</CardTitle>
                    <CardBody className="mt-3">{card.body}</CardBody>
                    <p className="mt-5 font-mono text-[12px] text-fg-muted">{card.route}</p>
                  </a>
                ) : (
                  <LinkCard href={card.href} className="w-full">
                    <CardEyebrow>{card.eyebrow}</CardEyebrow>
                    <CardTitle className="mt-3">{card.title}</CardTitle>
                    <CardBody className="mt-3">{card.body}</CardBody>
                    <p className="mt-5 font-mono text-[12px] text-fg-muted">{card.route}</p>
                  </LinkCard>
                )}
              </li>
            ))}
          </ul>
        </section>

        <DocSection id="validate" title="Validate a config">
          <p>
            Paste a <code>ServerSettings.ini</code> and get the same verdict the server&apos;s
            validate endpoint would give: keys it does not read are stripped, values out of range
            are errors, and a listener that cannot start says so before you restart anything.
          </p>
          <ConfigValidator template={template} />
        </DocSection>

        <DocSection id="template" title="The annotated template">
          <p>
            Every section the server honours, key by key: what it does, the default, and when a
            change takes effect. The starter template ships every one of them.
          </p>
          <IniViewer template={template} />
        </DocSection>

        <Callout tone="note" title="Building something?" className="not-prose">
          The spec gives you a client in any language, and the reference has a copy-paste block for
          Claude or ChatGPT. Everything here is unofficial, so verify against your own server.
        </Callout>
      </DocsShell>
    </>
  );
}
