"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";

const DURATION_MS = 400;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Motion vocabulary "count" (§2.4): numbers tween over 400 ms; reduced motion → instant. */
export function useCountTween(value: number): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(value);
  const shownRef = React.useRef(value);

  React.useEffect(() => {
    if (reduced || !Number.isFinite(value)) return;
    const from = shownRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / DURATION_MS);
      const v = k >= 1 ? value : Math.round(from + (value - from) * ease(k));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  if (reduced || !Number.isFinite(value)) return value;
  return shown;
}

/** A tabular number that tweens to its new value. */
export function Count({ value, className }: { value: number; className?: string }) {
  const shown = useCountTween(value);
  return <span className={className}>{shown}</span>;
}
