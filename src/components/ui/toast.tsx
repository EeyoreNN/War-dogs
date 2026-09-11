"use client";

import * as React from "react";
import { create } from "zustand";
import { X } from "lucide-react";
import { announce } from "./live-region";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export type ToastTone = "default" | "ok" | "warn" | "danger";

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: ToastItem) => void;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 4;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts, t].slice(-MAX_VISIBLE) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let seq = 0;

/** Show a toast and announce it once through the LiveRegion. */
export function toast(
  message: string,
  opts: {
    tone?: ToastTone;
    action?: { label: string; onClick: () => void };
    durationMs?: number;
  } = {},
): void {
  const id = ++seq;
  const durationMs = opts.durationMs ?? (opts.action ? 6000 : 4000);
  useToastStore
    .getState()
    .push({ id, message, tone: opts.tone ?? "default", action: opts.action, durationMs });
  announce(message);
  if (durationMs > 0) setTimeout(() => useToastStore.getState().dismiss(id), durationMs);
}

const toneRule: Record<ToastTone, string> = {
  default: "border-l-line-hi",
  ok: "border-l-ok",
  warn: "border-l-warn",
  danger: "border-l-danger",
};

/** Mount once in the root layout. `aria-live="off"`: the LiveRegion does the announcing. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="off"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex flex-col items-stretch gap-2 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px] sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-full items-center gap-3 panel border-l-[3px] py-3 pr-2 pl-4 shadow-panel",
            toneRule[t.tone],
          )}
        >
          <p className="min-w-0 flex-1 text-sm text-fg">{t.message}</p>
          {t.action ? (
            <Button
              variant="chip"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </Button>
          ) : null}
          <Button variant="icon" size="icon" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}
