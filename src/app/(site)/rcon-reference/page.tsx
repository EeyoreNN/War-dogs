import type { Metadata } from "next";
import { DocSection, DocsShell } from "@/components/docs/DocsShell";
import { JsonLd } from "@/components/site/json-ld";
import { docJsonLd } from "@/content/dev/json-ld";
import { rconReference as doc } from "@/content/dev/rcon-reference";
import { getSpec } from "@/lib/openapi/match";

const description = "The RCON HTTP API and ServerSettings.ini, every endpoint and key documented.";

export const metadata: Metadata = {
  title: "Wardogs Server Reference (Unofficial)",
  description,
  alternates: { canonical: "/rcon-reference" },
};

export default function RconReferencePage() {
  const { info } = getSpec();
  return (
    <>
      {docJsonLd({
        path: "/rcon-reference",
        title: doc.title,
        description,
        updated: info.updated,
      }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <DocsShell
        eyebrow={doc.eyebrow}
        unofficialLine={doc.unofficialLine}
        title={doc.title}
        intro={doc.intro}
        toc={doc.sections.map(({ id, title }) => ({ id, title }))}
        updated={info.updated}
        version={info.version}
      >
        {doc.sections.map((s) => (
          <DocSection key={s.id} id={s.id} title={s.title}>
            {s.body}
          </DocSection>
        ))}
      </DocsShell>
    </>
  );
}
