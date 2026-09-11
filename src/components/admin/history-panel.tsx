"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { site, type Team } from "@/config/site";
import { mapName, zoneName } from "@/lib/admin-sim/engine";
import type { MatchRecord, SimState } from "@/lib/admin-sim/types";
import { cn } from "@/lib/utils";
import { TEAM_BG, TEAM_TEXT, clock, dayLabel, humanDuration, kd, timeOfDay } from "./format";
import { ScoreChart } from "./score-chart";
import { SectionHeading, td, tdNum, th, thNum, zebra } from "./select";

type Sub = "matches" | "players" | "leaderboard";

function groupByDay(history: MatchRecord[]): { day: string; matches: MatchRecord[] }[] {
  const groups: { day: string; matches: MatchRecord[] }[] = [];
  for (const m of history) {
    const day = dayLabel(m.endedAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.matches.push(m);
    else groups.push({ day, matches: [m] });
  }
  return groups;
}

function MatchRow({ m, cap }: { m: MatchRecord; cap: number }) {
  const board = [...m.players]
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .slice(0, 12);
  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm outline-none hover:bg-[rgba(255,255,255,0.02)] focus-visible:bg-bg-2 [&::-webkit-details-marker]:hidden">
        <span className="w-14 font-mono text-[12px] text-fg-faint tabular-nums">#{m.n}</span>
        <span className="min-w-[140px] font-semibold text-fg">
          {mapName(m.map)} <span className="font-normal text-fg-muted">· {zoneName(m.zone)}</span>
        </span>
        <span className="flex gap-3 font-mono text-[12px] tabular-nums">
          {site.game.teams.map((team) => (
            <span key={team} className={cn(TEAM_TEXT[team], team === m.winner && "font-bold")}>
              {m.final[team]}
            </span>
          ))}
        </span>
        <Badge tone="team" team={m.winner}>
          {m.winner}
        </Badge>
        <span className="ml-auto font-mono text-[12px] text-fg-muted tabular-nums">
          {timeOfDay(m.startedAt)} · {clock(m.endedAt - m.startedAt)}
        </span>
      </summary>
      <div className="grid gap-4 pb-4 md:grid-cols-[minmax(0,280px)_1fr]">
        <div>
          <p className="mb-2 label-mono text-fg-faint">Score over the match</p>
          <ScoreChart
            record={m}
            cap={cap}
            className="h-28 w-full rounded-md border border-line bg-bg-0 p-1"
          />
          <p className="mt-2 font-mono text-[11px] text-fg-muted">{m.lighting}</p>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <caption className="sr-only">Player board for match {m.n}</caption>
            <thead>
              <tr className="label-mono text-fg-faint">
                <th scope="col" className={th}>
                  Callsign
                </th>
                <th scope="col" className={thNum}>
                  Kills
                </th>
                <th scope="col" className={thNum}>
                  Deaths
                </th>
                <th scope="col" className={thNum}>
                  K/D
                </th>
                <th scope="col" className={thNum}>
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {board.map((p) => (
                <tr key={p.steamId} className={zebra}>
                  <td className={cn(td, "text-fg")}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("h-2 w-2 rounded-full", TEAM_BG[p.team])}
                      />
                      {p.name}
                    </span>
                  </td>
                  <td className={tdNum}>{p.kills}</td>
                  <td className={tdNum}>{p.deaths}</td>
                  <td className={cn(tdNum, "text-fg-muted")}>{kd(p.kills, p.deaths)}</td>
                  <td className={cn(tdNum, "text-fg-muted")}>{humanDuration(p.seconds * 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.players.length > board.length ? (
            <p className="mt-2 text-xs text-fg-faint">
              Top {board.length} of {m.players.length} players.
            </p>
          ) : null}
        </div>
      </div>
    </details>
  );
}

interface PlayerAgg {
  steamId: string;
  name: string;
  sessions: { matchN: number; from: number; to: number }[];
  playtime: number;
  lastSeen: number;
}

function aggregatePlayers(state: SimState): PlayerAgg[] {
  const map = new Map<string, PlayerAgg>();
  for (const s of state.sessions) {
    let a = map.get(s.steamId);
    if (!a) {
      a = { steamId: s.steamId, name: s.name, sessions: [], playtime: 0, lastSeen: 0 };
      map.set(s.steamId, a);
    }
    a.sessions.push({ matchN: s.matchN, from: s.from, to: s.to });
    a.playtime += Math.max(0, s.to - s.from);
    a.lastSeen = Math.max(a.lastSeen, s.to);
  }
  return [...map.values()].sort((a, b) => b.playtime - a.playtime);
}

interface Leader {
  steamId: string;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  seconds: number;
}

function leaderboard(history: MatchRecord[]): Leader[] {
  const map = new Map<string, Leader>();
  for (const m of history) {
    for (const p of m.players) {
      const l = map.get(p.steamId) ?? {
        steamId: p.steamId,
        name: p.name,
        team: p.team,
        kills: 0,
        deaths: 0,
        seconds: 0,
      };
      l.kills += p.kills;
      l.deaths += p.deaths;
      l.seconds += p.seconds;
      l.team = p.team;
      map.set(p.steamId, l);
    }
  }
  return [...map.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).slice(0, 25);
}

export function HistoryPanel({ state }: { state: SimState }) {
  const [sub, setSub] = React.useState<Sub>("matches");
  const groups = React.useMemo(() => groupByDay(state.history), [state.history]);
  const players = React.useMemo(() => aggregatePlayers(state), [state]);
  const leaders = React.useMemo(() => leaderboard(state.history), [state.history]);
  const online = new Set(state.players.map((p) => p.steamId));

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="History · 72 hours">
        {state.history.length} matches on record, {players.length} players seen. The official
        console keeps none of this.
      </SectionHeading>
      <Tabs
        value={sub}
        onChange={(v) => setSub(v as Sub)}
        aria-label="History views"
        items={[
          { value: "matches", label: "Matches", badge: state.history.length },
          { value: "players", label: "Players", badge: players.length },
          { value: "leaderboard", label: "Leaderboard" },
        ]}
      />

      <TabPanel value="matches" active={sub}>
        <div className="flex flex-col gap-6">
          {groups.map((g, gi) => (
            <details key={g.day} open={gi === 0} className="panel px-4 pb-1 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 outline-none focus-visible:text-accent [&::-webkit-details-marker]:hidden">
                <h3 className="eyebrow">{g.day}</h3>
                <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
                  {g.matches.length} matches
                </span>
              </summary>
              {g.matches.map((m) => (
                <MatchRow key={`${m.n}-${m.endedAt}`} m={m} cap={state.scoreCap} />
              ))}
            </details>
          ))}
        </div>
      </TabPanel>

      <TabPanel value="players" active={sub}>
        <div className="relative overflow-x-auto panel p-4 sm:p-6">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">Players seen in the last 72 hours</caption>
            <thead>
              <tr className="label-mono text-fg-faint">
                <th scope="col" className={th}>
                  Callsign
                </th>
                <th scope="col" className={thNum}>
                  Sessions
                </th>
                <th scope="col" className={thNum}>
                  Playtime
                </th>
                <th scope="col" className={thNum}>
                  Last seen
                </th>
                <th scope="col" className={th}>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <React.Fragment key={p.steamId}>
                  <tr className={zebra}>
                    <td className={cn(td, "text-fg")}>
                      <span className="inline-flex items-center gap-2">
                        {online.has(p.steamId) ? (
                          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
                        ) : (
                          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-bg-3" />
                        )}
                        {p.name}
                        {online.has(p.steamId) ? <span className="sr-only">(online)</span> : null}
                      </span>
                      <span className="block font-mono text-[11px] text-fg-faint">{p.steamId}</span>
                    </td>
                    <td className={tdNum}>{p.sessions.length}</td>
                    <td className={cn(tdNum, "text-fg")}>{humanDuration(p.playtime)}</td>
                    <td className={cn(tdNum, "text-fg-muted")}>
                      {online.has(p.steamId)
                        ? "now"
                        : humanDuration(state.now - p.lastSeen) + " ago"}
                    </td>
                    <td className={td}>
                      <details>
                        <summary className="cursor-pointer font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase hover:text-fg">
                          Sessions
                        </summary>
                        <ul className="mt-2 flex flex-col gap-1 font-mono text-[12px] text-fg-muted">
                          {p.sessions
                            .slice()
                            .sort((a, b) => b.from - a.from)
                            .map((s) => (
                              <li key={`${s.matchN}-${s.from}`}>
                                #{s.matchN} · {timeOfDay(s.from)}–{timeOfDay(s.to)} ·{" "}
                                {humanDuration(s.to - s.from)}
                              </li>
                            ))}
                        </ul>
                      </details>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </TabPanel>

      <TabPanel value="leaderboard" active={sub}>
        <div className="relative overflow-x-auto panel p-4 sm:p-6">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Leaderboard for the last 72 hours</caption>
            <thead>
              <tr className="label-mono text-fg-faint">
                <th scope="col" className={thNum}>
                  #
                </th>
                <th scope="col" className={th}>
                  Callsign
                </th>
                <th scope="col" className={thNum}>
                  Kills
                </th>
                <th scope="col" className={thNum}>
                  Deaths
                </th>
                <th scope="col" className={thNum}>
                  K/D
                </th>
                <th scope="col" className={thNum}>
                  Playtime
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l, i) => (
                <tr key={l.steamId} className={zebra}>
                  <td className={cn(tdNum, "text-fg-faint")}>{i + 1}</td>
                  <td className={cn(td, "text-fg")}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("h-2 w-2 rounded-full", TEAM_BG[l.team])}
                      />
                      {l.name}
                    </span>
                  </td>
                  <td className={cn(tdNum, "text-fg")}>{l.kills}</td>
                  <td className={tdNum}>{l.deaths}</td>
                  <td className={cn(tdNum, "text-fg-muted")}>{kd(l.kills, l.deaths)}</td>
                  <td className={cn(tdNum, "text-fg-muted")}>{humanDuration(l.seconds * 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TabPanel>
    </div>
  );
}
