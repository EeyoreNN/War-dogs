import * as React from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import { tokenize } from "./highlight";

/**
 * A code block with a header bar (language / filename left, copy chip right). Server component;
 * the CopyButton inside is the client island. `wrap` soft-wraps long lines (prose snippets).
 */
export function CodeBlock({
  code,
  lang,
  filename,
  wrap = false,
  className,
}: {
  code: string;
  lang?: string;
  filename?: string;
  wrap?: boolean;
  className?: string;
}) {
  const tokens = tokenize(code, lang);
  return (
    <figure
      className={cn("not-prose overflow-hidden rounded-md border border-line bg-bg-0", className)}
    >
      <figcaption className="flex h-9 items-center justify-between gap-3 border-b border-line bg-bg-1/70 pr-1 pl-3">
        <span className="truncate font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase">
          {filename ?? lang ?? "text"}
        </span>
        <CopyButton text={code} variant="chip" size="sm" className="h-7" />
      </figcaption>
      <pre
        className={cn(
          "scrollbar-thin overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-fg",
          wrap && "[overflow-wrap:anywhere] whitespace-pre-wrap",
        )}
        tabIndex={0}
      >
        <code>
          {tokens.map((t, i) =>
            t.cls ? (
              <span key={i} className={t.cls}>
                {t.text}
              </span>
            ) : (
              <React.Fragment key={i}>{t.text}</React.Fragment>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}

/** Inline code inside prose that lives outside `.docs-prose` (cards, callouts). */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-bg-2 px-1.5 py-0.5 font-mono text-[0.8125rem] text-fg">
      {children}
    </code>
  );
}

/** A data table inside an `overflow-x-auto` wrapper so it can be wider than the phone. */
export function DocTable({
  caption,
  head,
  children,
  className,
}: {
  caption?: string;
  head: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("-mx-6 scrollbar-thin overflow-x-auto sm:mx-0", className)}>
      <table className="docs-table min-w-[560px] sm:min-w-0">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
