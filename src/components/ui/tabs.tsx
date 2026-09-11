"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  badge?: number;
}

/* Ids derive from the value so a sibling TabPanel can point back without a context. */
const tabId = (value: string) => `tab-${value}`;
const panelId = (value: string) => `tabpanel-${value}`;

/**
 * WAI-ARIA tabs for in-page panels: roving tabindex, Left / Right / Home / End move and select.
 * Route-level navigation is a `<nav aria-label>` of links with `aria-current`, never Tabs.
 */
export function Tabs({
  value,
  onChange,
  items,
  "aria-label": ariaLabel,
  size = "md",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  items: TabItem[];
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}) {
  const tabsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const n = items.length;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
        next = (index + 1) % n;
        break;
      case "ArrowLeft":
        next = (index - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(items[next].value);
    tabsRef.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex items-end gap-1 border-b border-line", className)}
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabsRef.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(item.value)}
            aria-selected={selected}
            aria-controls={panelId(item.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 font-mono tracking-[0.14em] text-fg-muted uppercase transition-colors hover:text-fg aria-selected:border-accent aria-selected:text-fg",
              size === "sm" ? "h-8 text-[11px]" : "h-10 text-[12px]",
            )}
          >
            {item.label}
            {item.badge !== undefined ? (
              <span className="rounded-sm bg-bg-2 px-1 text-[11px] leading-4 tabular-nums">
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  value,
  active,
  children,
  className,
}: {
  value: string;
  active: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(value)}
      aria-labelledby={tabId(value)}
      hidden={value !== active}
      className={className}
    >
      {children}
    </div>
  );
}
