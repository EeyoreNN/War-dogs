"use client";

import * as React from "react";

/**
 * "rise" (§2.4 #1): opacity 0→1 and translateY 12→0 on entry, once, viewport margin −10 %,
 * staggered 60 ms per `index`. Content never depends on a script: the server renders every
 * element visible (`data-rise="in"`), and only elements that are still below the fold at
 * hydration are switched to the pre-animation state, then revealed by an IntersectionObserver
 * or, no matter what, by a safety timer. Print and reduced motion never leave the visible state.
 * The transition itself is CSS (`[data-rise]` in globals.css); the `motion` runtime is
 * deliberately not on the marketing pages (§7.3 budget; see the site report).
 */
export const RISE_SAFETY_MS = 1500;

export function Rise({
  children,
  index = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const ref = React.useRef<HTMLElement | null>(null);

  // The flip is a DOM attribute, not React state: nothing re-renders, once is once.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Above or inside the fold at hydration: stays visible, no animation.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      el.setAttribute("data-rise", "in");
      io.disconnect();
      window.clearTimeout(timer);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      { rootMargin: "-10% 0px -10% 0px", threshold: 0 },
    );
    const timer = window.setTimeout(reveal, RISE_SAFETY_MS);
    el.setAttribute("data-rise", "pending");
    io.observe(el);
    return () => {
      done = true;
      io.disconnect();
      window.clearTimeout(timer);
      el.setAttribute("data-rise", "in");
    };
  }, []);

  const props = {
    ref: ref as React.Ref<never>,
    "data-rise": "in",
    style: { "--rise-delay": `${Math.min(index, 6) * 60}ms` } as React.CSSProperties,
    className,
  };
  return React.createElement(as, props, children);
}
