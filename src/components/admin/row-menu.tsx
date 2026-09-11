"use client";

import * as React from "react";
import { EllipsisVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

/**
 * A small accessible actions menu for table rows: `aria-haspopup="menu"`, arrow keys move,
 * Home/End jump, Esc closes and returns focus, click outside closes. No dependency.
 */
export function RowMenu({
  label,
  items,
  align = "right",
}: {
  label: string;
  items: MenuItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    );
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node) && e.target !== buttonRef.current)
        setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        nodes[(i + 1) % nodes.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        nodes[(i - 1 + nodes.length) % nodes.length]?.focus();
        break;
      case "Home":
        e.preventDefault();
        nodes[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        nodes[nodes.length - 1]?.focus();
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  return (
    <div className="relative inline-block">
      <Button
        ref={buttonRef}
        variant="icon"
        size="icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <EllipsisVertical size={16} aria-hidden="true" />
      </Button>
      {open ? (
        <div
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute z-30 mt-1 min-w-[200px] panel py-1 shadow-panel",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={it.disabled || undefined}
              onClick={() => {
                if (it.disabled) return;
                close();
                it.onSelect();
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm outline-none hover:bg-bg-2 focus-visible:bg-bg-2",
                it.tone === "danger" ? "text-danger-text" : "text-fg",
                it.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
