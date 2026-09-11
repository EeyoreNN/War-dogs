"use client";

// The 2 × 3 focus grid (§4.5): lucide icons per focus, `role="radiogroup"`, optional.
import { Car, ChevronUp, Crosshair, Plane, Plus, Wrench } from "lucide-react";
import { FOCUS_LABEL, FOCUSES, type Focus } from "@/lib/map/types";
import { cn } from "@/lib/utils";

export const FOCUS_ICON: Record<
  Focus,
  React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true"; className?: string }>
> = {
  infantry: ChevronUp,
  medic: Plus,
  recon: Crosshair,
  support: Wrench,
  driver: Car,
  pilot: Plane,
};

export function FocusGrid({
  value,
  onChange,
  compact = false,
}: {
  value: Focus | null;
  onChange: (f: Focus | null) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Your focus"
      className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}
    >
      {FOCUSES.map((f) => {
        const Icon = FOCUS_ICON[f];
        const checked = value === f;
        return (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(checked ? null : f)}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong bg-bg-1 px-3 text-sm font-semibold text-fg-muted transition-colors hover:border-line-hi hover:text-fg",
              checked && "border-accent bg-accent-soft text-accent",
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {FOCUS_LABEL[f]}
          </button>
        );
      })}
    </div>
  );
}
