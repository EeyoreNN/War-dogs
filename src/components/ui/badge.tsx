import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "accent" | "muted" | "ok" | "danger" | "info" | "warn";
const tones: Record<Tone, string> = {
  accent: "border-accent/40 bg-accent-soft text-accent",
  muted: "border-line-strong bg-bg-2 text-fg-muted",
  ok: "border-ok/40 bg-ok/10 text-ok",
  danger: "border-danger/40 bg-danger/10 text-danger",
  info: "border-info/40 bg-info/10 text-info",
  warn: "border-warn/40 bg-warn/10 text-warn",
};

export function Badge({
  tone = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
