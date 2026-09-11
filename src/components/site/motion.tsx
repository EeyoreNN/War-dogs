"use client";

import * as React from "react";
import { LazyMotion, m, useReducedMotion } from "motion/react";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/** Wraps marketing sections once; `m.*` components below it render without the full runtime. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

/**
 * "rise" (§2.4): opacity 0→1 and translateY 12→0 on entry, once, viewport margin −10 %,
 * staggered 60 ms per `index`. Reduced motion: opacity only over 120 ms.
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
  const reduced = useReducedMotion();
  const Tag = as === "li" ? m.li : as === "section" ? m.section : m.div;
  return (
    <Tag
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={
        reduced
          ? { duration: 0.12 }
          : { duration: 0.24, ease: EASE, delay: Math.min(index, 6) * 0.06 }
      }
    >
      {children}
    </Tag>
  );
}
