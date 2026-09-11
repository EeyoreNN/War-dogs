import type { Metadata } from "next";
import { DocSection, DocsShell } from "@/components/docs/DocsShell";
import { JsonLd } from "@/components/site/json-ld";
import { docJsonLd } from "@/content/dev/json-ld";
import { mapGuide as doc } from "@/content/dev/map-guide";

const description =
  "How this site draws its maps, the coordinate system, grid references and custom uploads.";

export const metadata: Metadata = {
  title: "Map guide",
  description,
  alternates: { canonical: "/map-guide" },
};

export default function MapGuidePage() {
  return (
    <>
      {docJsonLd({ path: "/map-guide", title: doc.title, description }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <DocsShell
        eyebrow={doc.eyebrow}
        unofficialLine={doc.unofficialLine}
        title={doc.title}
        intro={doc.intro}
        toc={doc.sections.map(({ id, title }) => ({ id, title }))}
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
