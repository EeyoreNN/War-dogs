import { CONTOUR_PATHS, CONTOUR_VIEWBOX } from "@/lib/brand/contours";
import { cn } from "@/lib/utils";

/**
 * Decorative contour rings, anchored top-right. Only behind the home hero and page-title blocks
 * (§2.5). The parent must be `relative`; the SVG is absolutely positioned and inert.
 */
export function ContourBackdrop({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={CONTOUR_VIEWBOX}
      preserveAspectRatio="xMaxYMin slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full select-none", className)}
    >
      {CONTOUR_PATHS.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.07}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
