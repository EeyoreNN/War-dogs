import * as React from "react";
import type { Team } from "@/config/site";
import { cn } from "@/lib/utils";

export type BadgeTone = "accent" | "muted" | "ok" | "danger" | "info" | "warn" | "team";

const tones: Record<BadgeTone, string> = {
  accent: "border-accent/40 bg-accent-soft text-accent",
  muted: "border-line-strong bg-bg-2 text-fg-muted",
  ok: "border-ok/40 bg-ok/10 text-ok",
  // 11 px text on the tinted ground needs --danger-text (6.1:1), not --danger (§2.3).
  danger: "border-danger/40 bg-danger/10 text-danger-text",
  info: "border-info/40 bg-info/10 text-info",
  warn: "border-warn/40 bg-warn/10 text-warn",
  team: "border-line-strong bg-bg-2 text-fg",
};

const teamDot: Record<Team, string> = {
  Lonestar: "bg-lonestar",
  Valkyra: "bg-valkyra",
  Manticore: "bg-manticore",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** With `tone="team"`: draws the team-colour dot (team identity only, never a map marker). */
  team?: Team;
}

/** Badges carry state, so the text is 11 px mono — never smaller. */
export function Badge({ tone = "muted", team, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] leading-4 tracking-[0.16em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    >
      {tone === "team" && team ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", teamDot[team])} />
      ) : null}
      {children}
    </span>
  );
}
