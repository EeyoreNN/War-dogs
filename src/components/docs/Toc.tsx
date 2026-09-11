"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  title: string;
}

/**
 * Which of `ids` is "current": the last heading target whose top has passed a line 25 % down the
 * viewport, tracked by an IntersectionObserver per target plus a scroll fallback for the tail.
 */
export function useScrollSpy(ids: string[]): string | null {
  const [active, setActive] = React.useState<string | null>(null);
  const key = ids.join("|");

  React.useEffect(() => {
    if (typeof window === "undefined" || key === "") return;
    const targets = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const pick = () => {
      const line = window.innerHeight * 0.25;
      let current: HTMLElement | null = null;
      for (const el of targets) {
        if (el.getBoundingClientRect().top <= line) current = el;
        else break;
      }
      // At the very bottom of the page the last section is current even if it is short.
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive((atEnd ? targets[targets.length - 1] : (current ?? targets[0])).id);
    };

    pick();
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        pick();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Observe too, so content that resizes (details opening) re-evaluates without a scroll.
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(onScroll, { rootMargin: "-25% 0px -60% 0px" });
    targets.forEach((t) => io?.observe(t));
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io?.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [key]);

  return active;
}

/** The section list: mono 12 px, numbered when the ids look like `01`, amber rule on the active one. */
export function TocNav({
  items,
  label = "Contents",
  spy = true,
  className,
}: {
  items: TocItem[];
  label?: string;
  spy?: boolean;
  className?: string;
}) {
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);
  const active = useScrollSpy(spy ? ids : []);
  const numbered = items.every((i) => /^\d{2}$/.test(i.id));
  return (
    <nav aria-label={label} className={cn("docs-toc", className)}>
      <ol className="border-l border-line-strong">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined}>
              {numbered ? <span className="docs-toc-num">{item.id}</span> : null}
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * "On this page": the h3s inside the article, discovered after mount (content is server-rendered
 * React, not a structured list). Renders nothing when a page has no h3s.
 */
const noop = () => () => {};
/** `id\ttitle` per h3, newline-joined: a string, so the store snapshot is stable by value. */
function scanHeadings(articleId: string): string {
  const root = document.getElementById(articleId);
  if (!root) return "";
  return Array.from(root.querySelectorAll<HTMLHeadingElement>("h3[id]"))
    .map((h) => `${h.id}\t${h.textContent?.replace(/#\s*$/, "").trim() ?? h.id}`)
    .join("\n");
}

export function OnThisPage({ articleId }: { articleId: string }) {
  const raw = React.useSyncExternalStore(
    noop,
    () => scanHeadings(articleId),
    () => "",
  );
  const items = React.useMemo<TocItem[]>(
    () =>
      raw
        ? raw.split("\n").map((line) => {
            const [id, title] = line.split("\t");
            return { id, title };
          })
        : [],
    [raw],
  );
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);
  const active = useScrollSpy(ids);
  if (items.length === 0) return null;
  return (
    <nav aria-label="On this page" className="docs-toc">
      <p className="mb-3 label-mono">On this page</p>
      <ol className="border-l border-line-strong">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined}>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
