"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { focusFirst, trapTab } from "./focus";
import { cn } from "@/lib/utils";

export type SheetSnap = "peek" | "half" | "full";

const SNAP_ORDER: SheetSnap[] = ["peek", "half", "full"];
const snapHeight: Record<SheetSnap, string> = {
  peek: "h-14",
  half: "h-[50dvh]",
  full: "h-[90dvh]",
};

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** `right`: 360 px desktop panel. `bottom`: mobile sheet with snap points. */
  side: "right" | "bottom";
  title: string;
  /** Modal sheets get a backdrop, a focus trap and `role="dialog"`; others are a `region`. */
  modal?: boolean;
  snap?: SheetSnap;
  onSnap?: (s: SheetSnap) => void;
  /** Count shown on the bottom sheet's handle (e.g. open requests). */
  handleBadge?: number;
  children: React.ReactNode;
}

export function Sheet({
  open,
  onClose,
  side,
  title,
  modal = false,
  snap = "half",
  onSnap,
  handleBadge,
  children,
}: SheetProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modal || el?.contains(document.activeElement)) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    if (modal && el) {
      restoreRef.current = document.activeElement as HTMLElement | null;
      focusFirst(el);
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      if (modal) {
        restoreRef.current?.focus();
        restoreRef.current = null;
      }
    };
  }, [open, modal, onClose]);

  if (!open) return null;

  const nextSnap = SNAP_ORDER[(SNAP_ORDER.indexOf(snap) + 1) % SNAP_ORDER.length];
  const bottom = side === "bottom";

  return (
    <>
      {modal ? (
        <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      ) : null}
      <div
        ref={ref}
        role={modal ? "dialog" : "region"}
        aria-modal={modal || undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={modal ? (e) => ref.current && trapTab(ref.current, e) : undefined}
        className={cn(
          "fixed z-[70] flex flex-col border-line bg-bg-1 shadow-panel outline-none",
          bottom
            ? cn(
                "inset-x-0 bottom-0 rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] transition-[height] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
                snapHeight[snap],
              )
            : "inset-y-0 right-0 w-[360px] max-w-full border-l pr-[env(safe-area-inset-right)]",
        )}
      >
        {bottom ? (
          <button
            type="button"
            onClick={() => onSnap?.(nextSnap)}
            aria-label={`${title}: ${snap}. Show ${nextSnap}`}
            className="flex h-14 shrink-0 items-center justify-center gap-3 px-4 text-fg"
          >
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-bg-3" />
            <span id={titleId} className="label-mono text-fg">
              {title}
            </span>
            {handleBadge !== undefined ? (
              <span className="rounded-sm bg-accent-soft px-1.5 font-mono text-[11px] leading-4 text-accent tabular-nums">
                {handleBadge}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line pr-2 pl-4">
            <h2 id={titleId} className="label-mono text-fg">
              {title}
            </h2>
            <Button variant="icon" size="icon" aria-label="Close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
