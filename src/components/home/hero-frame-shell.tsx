import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The tier-3 hero map frame (§4.1): a 16:10 `overflow-hidden` box (4:3 below `lg`) with HUD
 * corner ticks, the strong border, the panel shadow and the amber ground glow. Everything inside
 * — the 32 px top bar (mark, `WAR ROOM DEMO`, LIVE pip), the map and the "take over" overlay — is
 * WP3's `<HeroFrame><HeroStatic /></HeroFrame>` (§3.13): `HeroStatic` is the server-rendered LCP
 * image, `HeroFrame` owns the focusable wrapper (Enter → `/demo`) and swaps in the lazily
 * loaded `HeroPlayer` in place. This shell draws no chrome of its own, so nothing is doubled.
 */
export function HeroFrameShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // The ticks live on this outer, unclipped box: inside the rounded `overflow-hidden` shell a
    // 10 px L drawn at the exact corner is cut to a sliver by the 12 px radius.
    <div className={cn("relative w-full max-w-full", className)}>
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line-strong bg-bg-0 shadow-panel lg:aspect-[16/10]",
          "shadow-[0_40px_120px_-40px_rgba(255,160,40,0.25),0_10px_30px_-12px_rgba(0,0,0,0.6)]",
          // HeroFrame's own focus outline sits outside its box and is clipped by `overflow-hidden`;
          // the shell draws the ring on itself while the frame inside has keyboard focus.
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        )}
      >
        <div className="absolute inset-0">{children}</div>
      </div>
      <div aria-hidden="true" className="hud-corners pointer-events-none absolute -inset-px z-10" />
    </div>
  );
}
