import { cn } from "@/lib/utils";
import { site } from "@/config/site";

/**
 * Brand mark: a rounded plate with a rank chevron and an amber map pin.
 * Original artwork for this project (not the upstream site's icon).
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill="var(--bg-2)"
        stroke="var(--border-hi)"
        strokeWidth="2"
      />
      <path
        d="M14 27 L32 15 L50 27"
        stroke="var(--text-0)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 39 L24 32.5" stroke="var(--text-0)" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 39 L40 32.5" stroke="var(--text-0)" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M32 30 c-5 0 -8.5 3.6 -8.5 8.3 0 6.2 8.5 14.7 8.5 14.7 s8.5 -8.5 8.5 -14.7 C40.5 33.6 37 30 32 30 z"
        fill="var(--accent)"
      />
      <circle cx="32" cy="38.5" r="3" fill="var(--bg-0)" />
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
      className={cn("flex items-baseline display leading-none tracking-[0.02em]", text, className)}
    >
      <span className="text-fg">{site.shortName}</span>
      <span className="text-accent">{site.tld}</span>
    </span>
  );
}

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const px = size === "lg" ? 36 : size === "sm" ? 22 : 28;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={px} />
      <Wordmark size={size} />
    </span>
  );
}
