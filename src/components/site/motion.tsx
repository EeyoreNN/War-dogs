"use client";

import * as React from "react";

/**
 * "rise" (§2.4 #1): opacity 0→1 and translateY 12→0 on entry, once, viewport margin −10 %,
 * staggered 60 ms per `index`. The transition itself is CSS (`[data-rise]` in globals.css) so
 * `prefers-reduced-motion` and `@media (scripting: none)` are honoured without any script:
 * the `motion` runtime is deliberately not on the marketing pages (§7.3 budget; see the
 * site report). Reduced motion: opacity only, instant.
 */
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
    const reveal = () => el.setAttribute("data-rise", "in");
    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          io.disconnect();
        }
      },
      { rootMargin: "-10% 0px -10% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const props = {
    ref: ref as React.Ref<never>,
    "data-rise": "pending",
    style: { "--rise-delay": `${Math.min(index, 6) * 60}ms` } as React.CSSProperties,
    className,
  };
  return React.createElement(as, props, children);
}
