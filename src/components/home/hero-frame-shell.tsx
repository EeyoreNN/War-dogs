"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

/**
 * The tier-3 hero map frame (§4.1): 16:10, HUD corner ticks, amber ground glow, a 32 px top bar
 * (mark, `WAR ROOM DEMO`, LIVE pip with scanlines) and the "take over" overlay. `children` is
 * the map — `<HeroFrame><HeroStatic/></HeroFrame>` from WP3 once merged; a `Skeleton` until then.
 * Focusable: Enter opens the demo.
 */
export function HeroFrameShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Live preview of the shared map; press Enter to open the demo"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.currentTarget === e.target) {
          e.preventDefault();
          router.push("/demo");
        }
      }}
      className={cn(
        "hud-corners relative flex aspect-[16/10] w-full max-w-full flex-col overflow-hidden rounded-xl border border-line-strong bg-bg-1/90 shadow-panel backdrop-blur",
        "shadow-[0_40px_120px_-40px_rgba(255,160,40,0.25),0_10px_30px_-12px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-8 shrink-0 items-center gap-3 border-b border-line bg-bg-1 px-3"
      >
        <LogoMark size={16} />
        <span className="font-mono text-[11px] tracking-[0.16em] text-fg-muted uppercase">
          War room <span className="text-fg">Demo</span>
        </span>
        <span className="ml-auto inline-flex h-5 items-center gap-1.5 rounded-sm border border-ok/40 bg-ok/10 scanlines px-2 font-mono text-[10px] tracking-[0.16em] text-ok uppercase">
          <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-ok" />
          Live
        </span>
      </div>
      <div className="relative min-h-0 flex-1 bg-bg-0">{children}</div>
      <div className="pointer-events-none absolute right-3 bottom-3 z-10">
        <ButtonLink
          href="/demo"
          variant="secondary"
          size="sm"
          className="pointer-events-auto tracking-normal normal-case"
        >
          This is the real app — take over →
        </ButtonLink>
      </div>
    </div>
  );
}
