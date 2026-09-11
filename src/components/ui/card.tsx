import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardTier = "panel" | "link" | "live";

/* Tier 2: hover / focus-within lift the border, and a 2 px accent rule grows from the left. */
const linkTier =
  "group relative overflow-hidden transition-colors duration-200 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:origin-left before:scale-x-0 before:bg-accent before:transition-transform before:duration-200 hover:border-line-hi hover:bg-bg-2 hover:before:scale-x-100 focus-within:border-line-hi focus-within:bg-bg-2 focus-within:before:scale-x-100";

/* Tier 3: HUD corner ticks, panel shadow, translucent blur. */
const liveTier = "hud-corners bg-bg-1/90 shadow-panel backdrop-blur";

export function cardClasses(tier: CardTier = "panel", className?: string) {
  return cn("panel", tier === "link" && linkTier, tier === "live" && liveTier, className);
}

export function Card({
  tier = "panel",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tier?: CardTier }) {
  return <div className={cardClasses(tier, className)} {...props} />;
}

export interface LinkCardProps extends Omit<React.ComponentProps<typeof Link>, "className"> {
  className?: string;
  children: React.ReactNode;
}

/** Tier-2 card where the whole card is the link; arrow top-right nudges up-right on hover. */
export function LinkCard({ className, children, ...props }: LinkCardProps) {
  return (
    <Link className={cn(cardClasses("link"), "block p-6 no-underline", className)} {...props}>
      <ArrowUpRight
        aria-hidden="true"
        size={18}
        className="absolute top-5 right-5 text-fg-faint transition-transform duration-200 group-focus-within:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
      />
      {children}
    </Link>
  );
}

export function CardEyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("eyebrow", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("display display-3 text-fg", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[15px] leading-relaxed text-fg-muted", className)} {...props} />;
}
