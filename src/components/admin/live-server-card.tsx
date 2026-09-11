"use client";

import * as React from "react";
import { site, type Team } from "@/config/site";
import { mapName } from "@/lib/admin-sim/engine";
import type { SimState } from "@/lib/admin-sim/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCountTween } from "./count-tween";
import { TEAM_BG, TEAM_TEXT, clock, humanDuration, rosterToday } from "./format";
import { useSim } from "./sim-provider";

/**
 * The tier-3 live card (§4.8): scoreboard with tweened scores, a 4-up metrics row and a
 * five-row roster preview. `LiveServerCard` is pure (renders a given state); `LiveCardIsland`
 * wires it to the running simulation and shows a Skeleton until the client mounts.
 */

function ScoreTile({
  team,
  score,
  cap,
  compact,
}: {
  team: Team;
  score: number;
  cap: number;
  compact: boolean;
}) {
  const shown = useCountTween(score);
  return (
    <div className="min-w-0 border-t-[3px] border-line-strong pt-3">
      <p className={cn("flex items-center gap-2 eyebrow", TEAM_TEXT[team])}>
        <span
          aria-hidden="true"
          className={cn("inline-block h-2 w-2 rounded-full", TEAM_BG[team])}
        />
        {team}
      </p>
      <p
        className={cn(
          "mt-1 display text-fg tabular-nums",
          compact
            ? "text-[32px] leading-none sm:text-[40px]"
            : "text-[32px] leading-none sm:text-[48px]",
        )}
        aria-label={`${team} ${score}`}
      >
        {shown}
      </p>
      <div className="mt-2 h-0.5 w-full bg-bg-3" aria-hidden="true">
        <div
          className={cn("h-full transition-[width] duration-300", TEAM_BG[team])}
          style={{ width: `${Math.min(100, (score / cap) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  children,
  bar,
}: {
  label: string;
  children: React.ReactNode;
  bar?: number;
}) {
  return (
    <div className="min-w-0">
      <p className="eyebrow text-fg-faint">{label}</p>
      <p className="mt-1 font-mono text-[20px] leading-none text-fg tabular-nums sm:text-[22px]">
        {children}
      </p>
      {bar !== undefined ? (
        <div className="mt-2 h-1 w-full bg-bg-3" aria-hidden="true">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${Math.min(100, bar * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function LiveServerCard({
  state,
  compact = false,
  className,
}: {
  state: SimState;
  compact?: boolean;
  className?: string;
}) {
  const elapsed = state.now - state.match.startedAt;
  const roster = rosterToday(state.sessions, state.now);
  const preview = [...state.players].sort((a, b) => a.joinedAt - b.joinedAt).slice(0, 5);
  return (
    <Card tier="live" className={cn("p-6 lg:p-7", className)} data-testid="live-server-card">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-[0.16em] text-fg-muted uppercase">
        <span className="inline-flex items-center gap-2 text-ok">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse-slow rounded-full bg-ok" />
          On the test server now
        </span>
        <span aria-hidden="true">·</span>
        <span className="text-fg">{state.serverName}</span>
      </p>
      <h2 className={cn("mt-3 display text-fg", compact ? "display-3" : "display-2")}>
        {mapName(state.map)}
      </h2>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] tracking-[0.08em]">
        <div className="flex gap-2">
          <dt className="text-fg-faint uppercase">Mode</dt>
          <dd className="text-fg-muted">{state.mode}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-fg-faint uppercase">Light</dt>
          <dd className="text-fg-muted">{state.lighting}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-fg-faint uppercase">Zone</dt>
          <dd className="text-fg-muted">{zoneLabel(state.zone)}</dd>
        </div>
      </dl>

      <div className="mt-6 grid grid-cols-3 gap-4 sm:gap-6" aria-label="Scoreboard" role="group">
        {site.game.teams.map((team) => (
          <ScoreTile
            key={team}
            team={team}
            score={state.scores[team]}
            cap={state.scoreCap}
            compact={compact}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 md:grid-cols-4">
        <Metric label="Players" bar={state.players.length / state.maxPlayers}>
          {state.players.length}/{state.maxPlayers}
        </Metric>
        <Metric label="Match">
          <span aria-live="off">{clock(elapsed)}</span>
        </Metric>
        <Metric label="Matches on record">{state.history.length}</Metric>
        <Metric label="Roster">{roster}</Metric>
      </div>

      {!compact ? (
        <div className="relative mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm sm:min-w-[420px]">
            <caption className="sr-only">Five of the players on the server right now</caption>
            <thead>
              <tr className="label-mono text-fg-faint">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Callsign
                </th>
                <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">
                  Faction
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Ping
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Session
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr
                  key={p.steamId}
                  className="border-t border-line odd:bg-[rgba(255,255,255,0.02)]"
                >
                  <td className="py-2 pr-3 text-fg">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("h-2 w-2 shrink-0 rounded-full", TEAM_BG[p.team])}
                      />
                      {p.name}
                    </span>
                  </td>
                  <td className="hidden py-2 pr-3 text-fg-muted sm:table-cell">{p.team}</td>
                  <td className="py-2 pr-3 text-right mono-data text-fg-muted">{p.pingMs} ms</td>
                  <td className="py-2 text-right mono-data text-fg-muted">
                    {humanDuration(state.now - p.joinedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}

function zoneLabel(zone: SimState["zone"]): string {
  return zone === "none"
    ? "None"
    : zone.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LiveCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card
      tier="live"
      className="p-6 lg:p-7"
      aria-busy="true"
      aria-label="Loading the live server card"
    >
      <Skeleton className="h-3 w-56" />
      <Skeleton className={cn("mt-4 w-48", compact ? "h-7" : "h-10")} />
      <Skeleton className="mt-3 h-3 w-72" />
      <div className="mt-6 grid grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      {!compact ? <Skeleton className="mt-6 h-40" /> : null}
    </Card>
  );
}

/** The live card wired to the running simulation (client island on /demo/admin). */
export function LiveCardIsland({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { state } = useSim();
  if (!state) return <LiveCardSkeleton compact={compact} />;
  return <LiveServerCard state={state} compact={compact} className={className} />;
}
