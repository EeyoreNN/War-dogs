import { cn } from "@/lib/utils";
import { site } from "@/config/site";
import { MARK_CHEVRON, MARK_PIN, MARK_PLATE, MARK_TICKS, MARK_VIEWBOX } from "@/lib/brand/mark";

/**
 * Brand mark (§2.8): plate, rank chevron, an amber rally point in the notch and two scale-bar
 * ticks. Original artwork; the geometry lives in `src/lib/brand/mark.ts` so OG images match.
 */
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        x={MARK_PLATE.x}
        y={MARK_PLATE.y}
        width={MARK_PLATE.w}
        height={MARK_PLATE.h}
        rx={MARK_PLATE.rx}
        fill="var(--bg-1)"
        stroke="var(--border-hi)"
        strokeWidth={2}
      />
      <path
        d={MARK_CHEVRON}
        stroke="var(--text-0)"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={MARK_PIN.cx} cy={MARK_PIN.cy} r={MARK_PIN.r} fill="var(--accent)" />
      <circle cx={MARK_PIN.cx} cy={MARK_PIN.cy} r={MARK_PIN.core} fill="var(--bg-0)" />
      {MARK_TICKS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 1} y={y - 1} width={2} height={2} fill="var(--text-2)" />
      ))}
    </svg>
  );
}

export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[16px]" : "text-[20px]";
  return (
    <span
      className={cn("flex items-baseline display leading-none tracking-normal", text, className)}
    >
      <span className="text-fg">{site.shortName}</span>
      <span className="text-accent">{site.tld}</span>
    </span>
  );
}

/** Lockup: 26 px mark + 20 px wordmark with a 10 px gap at `md`. */
export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const px = size === "lg" ? 36 : size === "sm" ? 20 : 26;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={px} />
      <Wordmark size={size} />
    </span>
  );
}
