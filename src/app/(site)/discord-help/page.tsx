import type { Metadata } from "next";
import { DocSection, DocsShell } from "@/components/docs/DocsShell";
import { DiscordStepper } from "@/components/docs/DiscordStepper";
import { JsonLd } from "@/components/site/json-ld";
import { discordHelp as doc } from "@/content/dev/discord-help";
import { docJsonLd } from "@/content/dev/json-ld";

const description =
  "The map will not launch in a voice channel: the permission that causes it, temp channels, and the one-minute test.";

export const metadata: Metadata = {
  title: "Discord help",
  description,
  alternates: { canonical: "/discord-help" },
};

const START = { id: "start-here", title: "Start here" };

export default function DiscordHelpPage() {
  return (
    <>
      {docJsonLd({ path: "/discord-help", title: doc.title, description }).map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}
      <DocsShell
        eyebrow={doc.eyebrow}
        unofficialLine={doc.unofficialLine}
        title={doc.title}
        intro={doc.intro}
        toc={[START, ...doc.sections.map(({ id, title }) => ({ id, title }))]}
      >
        <DocSection id={START.id} title={START.title}>
          <p>
            Three questions, one answer. It remembers where you were if you leave the page and come
            back in this tab.
          </p>
          <DiscordStepper />
        </DocSection>
        {doc.sections.map((s) => (
          <DocSection key={s.id} id={s.id} title={s.title}>
            {s.body}
          </DocSection>
        ))}
      </DocsShell>
    </>
  );
}
