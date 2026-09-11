import * as React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import { OnThisPage, TocNav } from "./Toc";
import "./docs.css";

const ARTICLE_ID = "docs-article";

/**
 * The docs page shell (§3.15 / §4.9): the UNOFFICIAL strip, the docs header row (eyebrow left,
 * mono `Updated … · v…` right), H1 + intro, then the TOC / content / "On this page" columns and
 * the docs footer line. Server component; the TOC scroll-spy is the only client island.
 *
 * The `(site)` layout already renders `SiteHeader` above `main`, so the strip sits at the top
 * of the page content, directly under the sticky header.
 */
export function DocsShell({
  eyebrow,
  unofficialLine,
  title,
  intro,
  toc,
  updated = site.updated,
  version = site.version,
  children,
}: {
  eyebrow: string;
  unofficialLine: string;
  title: string;
  intro?: React.ReactNode;
  toc: { id: string; title: string }[];
  /** Defaults: site.updated / site.version. API pages pass the spec's own info. */
  updated?: string;
  version?: string;
  children: React.ReactNode;
}) {
  const hasToc = toc.length > 0;
  return (
    <div className="docs">
      <div className="border-b border-line bg-bg-1">
        <Container className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-0.5 py-1 text-[13px] leading-5 text-fg-muted">
          <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Unofficial
          </span>
          <span>{unofficialLine}</span>
        </Container>
      </div>

      <Container className="pt-8 pb-16 lg:pt-10 lg:pb-24">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <p className="eyebrow">{eyebrow}</p>
          <p className="font-mono text-[11px] tracking-[0.16em] text-fg-muted uppercase">
            Updated {updated} · v{version}
          </p>
        </div>

        <div
          className={cn(
            "mt-10 gap-x-10 lg:grid",
            hasToc
              ? "lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_160px]"
              : "lg:grid-cols-[minmax(0,1fr)]",
          )}
        >
          {hasToc ? (
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] scrollbar-thin overflow-y-auto pr-2">
                <p className="mb-3 label-mono">Contents</p>
                <TocNav items={toc} />
              </div>
            </aside>
          ) : null}

          <div className={cn("min-w-0", !hasToc && "mx-auto w-full max-w-[960px]")}>
            {hasToc ? (
              <details className="mb-8 rounded-md border border-line bg-bg-1 lg:hidden">
                <summary className="cursor-pointer px-4 py-3 label-mono text-fg select-none">
                  Contents
                </summary>
                <div className="px-4 pt-1 pb-3">
                  <TocNav items={toc} spy={false} label="Contents (mobile)" />
                </div>
              </details>
            ) : null}
            <h1 className="display display-2 text-balance text-fg">{title}</h1>
            {intro ? <div className="mt-5 max-w-[68ch] lede">{intro}</div> : null}
            <article id={ARTICLE_ID} className="docs-prose mt-12 flex flex-col gap-14">
              {children}
            </article>
          </div>

          {hasToc ? (
            <aside className="hidden xl:block">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] scrollbar-thin overflow-y-auto">
                <OnThisPage articleId={ARTICLE_ID} />
              </div>
            </aside>
          ) : null}
        </div>

        <div className="mt-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-6 font-mono text-[12px] text-fg-muted">
          <span className="text-fg">
            {site.shortName}
            {site.tld} — {eyebrow.toUpperCase()}
          </span>
          <Link href="/" className="transition-colors hover:text-accent">
            Home
          </Link>
          <a
            href={site.links.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-accent"
          >
            Discord
          </a>
          <span>
            Fan-made · Not affiliated with {site.game.developer} or {site.game.publisher}
          </span>
        </div>
      </Container>
    </div>
  );
}

/** `<section aria-labelledby>` with the h2 and its hover "#" anchor link. */
export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="docs-section scroll-mt-24">
      <h2 id={headingId} className="docs-heading display display-3 text-fg">
        {/^\d{2}$/.test(id) ? (
          <span className="mr-3 font-mono text-[0.6em] font-normal tracking-[0.1em] text-accent">
            {id}
          </span>
        ) : null}
        {title}
        <a href={`#${id}`} className="docs-anchor" aria-label={`Link to ${title}`}>
          #
        </a>
      </h2>
      {children}
    </section>
  );
}
