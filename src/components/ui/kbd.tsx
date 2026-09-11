"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ModKey = "⌘" | "Ctrl";

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const subscribe = () => () => {};
const getSnapshot = (): ModKey => (isApplePlatform() ? "⌘" : "Ctrl");
const getServerSnapshot = (): ModKey => "Ctrl";

/**
 * "Ctrl" during SSR and the hydrating render, then "⌘" on Apple platforms once mounted — server
 * and client markup always match.
 */
export function useModifierKey(): ModKey {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Keycap. The literal token `Mod` in string children renders as the platform modifier. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  const mod = useModifierKey();
  const content = typeof children === "string" ? children.replace(/\bMod\b/g, mod) : children;
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong bg-bg-2 px-1 font-mono text-[11px] leading-none font-medium tracking-[0.04em] text-fg-muted",
        className,
      )}
    >
      {content}
    </kbd>
  );
}
