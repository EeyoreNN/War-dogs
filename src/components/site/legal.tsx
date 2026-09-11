import * as React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ContourBackdrop } from "@/components/site/contour-backdrop";
import { site } from "@/config/site";

export interface LegalSection {
  title: string;
  body: React.ReactNode;
}

/** `{contact}` in the legal copy: the contact address when set, else the community Discord. */
export function ContactLine() {
  if (site.contactEmail) {
    return (
      <a href={`mailto:${site.contactEmail}`} className="text-fg underline underline-offset-4">
        {site.contactEmail}
      </a>
    );
  }
  return (
    <>
      reach us on the{" "}
      <a
        href={site.links.discord}
        target="_blank"
        rel="noopener noreferrer"
        className="text-fg underline underline-offset-4"
      >
        community Discord
      </a>
    </>
  );
}

/**
 * Terms / Privacy shell (§4.10): 68ch prose column, mono `Updated …` above a `display-2` H1,
 * a lede intro, h2 Barlow 600 20 px, and a cross-link at the end.
 */
export function LegalPage({
  title,
  intro,
  sections,
  related,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  related: { href: string; label: string };
}) {
  return (
    <article className="relative overflow-hidden py-[clamp(4rem,8vw,7rem)]">
      <ContourBackdrop />
      <Container className="relative">
        <div className="max-w-[68ch]">
          <p className="mb-3 mono-data text-[12px] tracking-[0.16em] text-fg-muted uppercase">
            Updated {site.legalUpdated}
          </p>
          <h1 className="display display-2 text-balance text-fg">{title}</h1>
          <p className="mt-6 border-l-2 border-accent pl-4 lede">{intro}</p>
          <div className="mt-12 flex flex-col gap-10">
            {sections.map((s) => (
              <section key={s.title} aria-labelledby={slug(s.title)}>
                <h2 id={slug(s.title)} className="text-[20px] leading-snug font-semibold text-fg">
                  {s.title}
                </h2>
                <div className="mt-3 text-fg-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4">
                  {s.body}
                </div>
              </section>
            ))}
          </div>
          <p className="mt-12 border-t border-line pt-6 text-sm text-fg-muted">
            See also the{" "}
            <Link href={related.href} className="text-fg underline underline-offset-4">
              {related.label}
            </Link>
            .
          </p>
        </div>
      </Container>
    </article>
  );
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
