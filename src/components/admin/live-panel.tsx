"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Megaphone,
  Map as MapIcon,
  RefreshCw,
  Square,
  SunMedium,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { Team } from "@/config/site";
import type { SimPlayer, SimState } from "@/lib/admin-sim/types";
import { cn } from "@/lib/utils";
import {
  BanDialog,
  BroadcastDialog,
  KickDialog,
  LightingDialog,
  MapDialog,
  WhisperDialog,
  otherTeams,
  type Target,
} from "./action-dialogs";
import { TEAM_BG, humanDuration, kd } from "./format";
import { LiveServerCard } from "./live-server-card";
import { RowMenu } from "./row-menu";
import { SectionHeading, td, tdNum, th, thNum, zebra } from "./select";
import { useAction } from "./sim-provider";

type SortKey = "name" | "team" | "kills" | "deaths" | "ping";
const SORTS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Callsign", numeric: false },
  { key: "team", label: "Faction", numeric: false },
  { key: "kills", label: "Kills", numeric: true },
  { key: "deaths", label: "Deaths", numeric: true },
  { key: "ping", label: "Ping", numeric: true },
];

function sortPlayers(players: SimPlayer[], key: SortKey, dir: 1 | -1): SimPlayer[] {
  const list = [...players];
  list.sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "team":
        return (a.team.localeCompare(b.team) || a.name.localeCompare(b.name)) * dir;
      case "kills":
        return (a.kills - b.kills || a.name.localeCompare(b.name)) * dir;
      case "deaths":
        return (a.deaths - b.deaths || a.name.localeCompare(b.name)) * dir;
      case "ping":
        return (a.pingMs - b.pingMs || a.name.localeCompare(b.name)) * dir;
    }
  });
  return list;
}

export function LivePanel({ state }: { state: SimState }) {
  const act = useAction();
  const [sortKey, setSortKey] = React.useState<SortKey>("kills");
  const [dir, setDir] = React.useState<1 | -1>(-1);
  const [whisper, setWhisper] = React.useState<Target | null>(null);
  const [kick, setKick] = React.useState<Target | null>(null);
  const [ban, setBan] = React.useState<Target | null>(null);
  const [banOpen, setBanOpen] = React.useState(false);
  const [broadcast, setBroadcast] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [lightOpen, setLightOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"end" | "restart" | null>(null);

  const players = React.useMemo(
    () => sortPlayers(state.players, sortKey, dir),
    [state.players, sortKey, dir],
  );

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setDir(SORTS.find((s) => s.key === key)?.numeric ? -1 : 1);
    }
  };

  const move = (p: SimPlayer, team: Team) => {
    act({ t: "move", steamId: p.steamId, team });
    toast(`${p.name} moved to ${team}.`, { tone: "ok" });
  };

  return (
    <div className="flex flex-col gap-6">
      <LiveServerCard state={state} compact />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Server actions">
        <Button variant="secondary" size="sm" onClick={() => setBroadcast(true)}>
          <Megaphone size={14} aria-hidden="true" /> Broadcast…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setMapOpen(true)}>
          <MapIcon size={14} aria-hidden="true" /> Override map…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setLightOpen(true)}>
          <SunMedium size={14} aria-hidden="true" /> Set lighting…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirm("restart")}>
          <RefreshCw size={14} aria-hidden="true" /> Restart match
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirm("end")}>
          <Square size={14} aria-hidden="true" /> End match
        </Button>
      </div>

      <section aria-labelledby="players-heading" className="panel p-4 sm:p-6">
        <SectionHeading title={`Players · ${state.players.length}`}>
          Click a column to sort. The actions menu on each row sends the same RCON call a real
          console would.
        </SectionHeading>
        <div className="relative mt-4 overflow-x-auto">
          <table
            className="w-full min-w-[720px] border-collapse text-sm"
            data-testid="players-table"
          >
            <caption id="players-heading" className="sr-only">
              Connected players
            </caption>
            <thead>
              <tr className="label-mono text-fg-faint">
                {SORTS.map((s) => {
                  const active = s.key === sortKey;
                  return (
                    <th
                      key={s.key}
                      scope="col"
                      aria-sort={active ? (dir === 1 ? "ascending" : "descending") : "none"}
                      className={s.numeric ? thNum : th}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(s.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm uppercase hover:text-fg",
                          active && "text-fg",
                        )}
                      >
                        {s.label}
                        {active ? (
                          dir === 1 ? (
                            <ArrowUp size={12} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={12} aria-hidden="true" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
                <th scope="col" className={thNum}>
                  K/D
                </th>
                <th scope="col" className={thNum}>
                  Cash
                </th>
                <th scope="col" className={thNum}>
                  Session
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const t: Target = { steamId: p.steamId, name: p.name };
                const reserved = state.reserved.includes(p.steamId);
                return (
                  <tr key={p.steamId} className={zebra} data-steamid={p.steamId}>
                    <td className={cn(td, "text-fg")}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn("h-2 w-2 shrink-0 rounded-full", TEAM_BG[p.team])}
                        />
                        <span className="font-medium">{p.name}</span>
                        {reserved ? (
                          <span className="rounded-sm bg-accent-soft px-1 font-mono text-[11px] tracking-[0.12em] text-accent uppercase">
                            reserved
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={cn(td, "text-fg-muted")}>{p.team}</td>
                    <td className={cn(tdNum, "text-fg")}>{p.kills}</td>
                    <td className={cn(tdNum, "text-fg")}>{p.deaths}</td>
                    <td className={cn(tdNum, p.pingMs > 120 ? "text-warn" : "text-fg-muted")}>
                      {p.pingMs} ms
                    </td>
                    <td className={cn(tdNum, "text-fg-muted")}>{kd(p.kills, p.deaths)}</td>
                    <td className={cn(tdNum, "text-fg-muted")}>${p.cash.toLocaleString()}</td>
                    <td className={cn(tdNum, "text-fg-muted")}>
                      {humanDuration(state.now - p.joinedAt)}
                    </td>
                    <td className="py-1 text-right">
                      <RowMenu
                        label={`Actions for ${p.name}`}
                        items={[
                          { label: "Whisper", onSelect: () => setWhisper(t) },
                          {
                            label: "Kill",
                            onSelect: () => {
                              act({ t: "kill", steamId: p.steamId });
                              toast(`${p.name} killed in-match.`);
                            },
                          },
                          ...otherTeams(p.team).map((team) => ({
                            label: `Move to ${team}`,
                            onSelect: () => move(p, team),
                          })),
                          { label: "Kick…", onSelect: () => setKick(t), tone: "danger" as const },
                          {
                            label: "Ban…",
                            onSelect: () => {
                              setBan(t);
                              setBanOpen(true);
                            },
                            tone: "danger" as const,
                          },
                          {
                            label: reserved ? "Release slot" : "Reserve slot",
                            onSelect: () => {
                              act(
                                reserved
                                  ? { t: "reserved.remove", steamId: p.steamId }
                                  : { t: "reserved.add", steamId: p.steamId },
                              );
                              toast(
                                reserved
                                  ? `Reserved slot released for ${p.name}.`
                                  : `Slot reserved for ${p.name}.`,
                                { tone: "ok" },
                              );
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <WhisperDialog
        target={whisper}
        onClose={() => setWhisper(null)}
        onSend={(steamId, text) => {
          act({ t: "whisper", steamId, text });
          toast(`Whispered ${whisper?.name ?? "player"}.`, { tone: "ok" });
        }}
      />
      <BroadcastDialog
        open={broadcast}
        onClose={() => setBroadcast(false)}
        onSend={(text) => {
          act({ t: "broadcast", text });
          toast("Broadcast sent to everyone on the server.", { tone: "ok" });
        }}
      />
      <KickDialog
        target={kick}
        onClose={() => setKick(null)}
        onKick={(steamId, reason) => {
          act({ t: "kick", steamId, reason });
          toast(`${kick?.name ?? "Player"} kicked. They can come back in a few minutes.`, {
            tone: "ok",
          });
        }}
      />
      <BanDialog
        open={banOpen}
        target={ban}
        roster={state.players}
        onClose={() => {
          setBanOpen(false);
          setBan(null);
        }}
        onBan={(steamId, reason, evidenceUrl, minutes) => {
          act({ t: "ban", steamId, reason, evidenceUrl, minutes });
          toast(
            `Banned for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}. See the Bans tab for the countdown.`,
            { tone: "ok" },
          );
        }}
      />
      <MapDialog
        open={mapOpen}
        current={{ map: state.map, zone: state.zone, lighting: state.lighting }}
        onClose={() => setMapOpen(false)}
        onSet={(map, zone, lighting) => {
          act({ t: "map.set", map, zone, lighting });
          toast("Map override sent. It holds until the next match.", { tone: "ok" });
        }}
      />
      <LightingDialog
        open={lightOpen}
        current={state.lighting}
        onClose={() => setLightOpen(false)}
        onSet={(value) => {
          act({ t: "lighting.set", value });
          toast(`Lighting set to ${value}.`, { tone: "ok" });
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          if (which === "end") {
            act({ t: "match.end" });
            toast(`Match ${state.match.n} ended. The next one starts now.`, { tone: "ok" });
          } else if (which === "restart") {
            act({ t: "match.restart" });
            toast(`Match ${state.match.n} restarted from zero.`, { tone: "ok" });
          }
        }}
        title={confirm === "end" ? `End match ${state.match.n}` : `Restart match ${state.match.n}`}
        confirmLabel={confirm === "end" ? "End match" : "Restart"}
        tone={confirm === "end" ? "danger" : "primary"}
        body={
          confirm === "end"
            ? "The board is frozen as the result, the record lands in History, and the next rotation entry starts immediately."
            : "Scores go back to zero on the same map. Nothing is recorded for the match so far."
        }
      />
    </div>
  );
}
