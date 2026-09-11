"use client";

// /create (§4.4): team, map, control zone, squads, access, Discord, callsign, recent plan, submit.
// Prefills (`?t=`, `?map=`, `?zone=`) come from window.location in a mount effect.
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/input";
import { RadioCards } from "@/components/ui/radio-cards";
import { MAP_LIST, mapById } from "@/config/maps";
import { site, type Team } from "@/config/site";
import { createRoomState } from "@/lib/map/reduce";
import { CallsignSchema } from "@/lib/map/schema";
import { DEFAULT_SQUADS, type RoomSettings, type RosterMember } from "@/lib/map/types";
import { newRoomCode } from "@/lib/room/code";
import { loadIdentity, saveIdentity } from "@/lib/storage/identity";
import { loadRoom, saveRoom } from "@/lib/storage/room";
import { listRecentRooms, touchRecentRoom } from "@/lib/storage/rooms";
import {
  CONTROL_ZONE_IDS,
  CONTROL_ZONE_LABEL,
  MAP_IDS,
  type ControlZoneId,
  type MapId,
} from "@/lib/terrain/types";
import { terrainUrl } from "@/lib/terrain/url";
import { cn } from "@/lib/utils";
import { CallsignField } from "@/components/map/forms/CallsignField";
import { DiscordButton } from "@/components/map/forms/DiscordButton";
import { FocusHelpDialog } from "@/components/map/forms/FocusHelp";
import { FormShell, GroupLabel, OrDivider } from "@/components/map/forms/FormShell";
import { timeAgo } from "@/components/map/lib/format";
import { clockNow, useMounted, useNow } from "@/components/map/context";

const TEAM_VAR: Record<Team, string> = {
  Lonestar: "var(--team-lonestar)",
  Valkyra: "var(--team-valkyra)",
  Manticore: "var(--team-manticore)",
};
const TEAM_TEXT: Record<Team, string> = {
  Lonestar: "text-lonestar",
  Valkyra: "text-valkyra",
  Manticore: "text-manticore",
};

function prefillFrom(search: string): { team?: Team; map?: MapId; zone?: ControlZoneId } {
  const q = new URLSearchParams(search);
  const t = q.get("t");
  const m = q.get("map")?.toLowerCase();
  const z = q.get("zone")?.toLowerCase();
  const team = t ? site.game.teams.find((x) => x.toLowerCase() === t.toLowerCase()) : undefined;
  return {
    ...(team ? { team } : {}),
    ...(m && (MAP_IDS as readonly string[]).includes(m) ? { map: m as MapId } : {}),
    ...(z && (CONTROL_ZONE_IDS as readonly string[]).includes(z)
      ? { zone: z as ControlZoneId }
      : {}),
  };
}

export function CreateForm() {
  const router = useRouter();
  const mounted = useMounted();
  // Prefills (`?t=`, `?map=`, `?zone=`, the saved callsign) are read after mount (§3.14) and only
  // apply until the user picks something; the defaults render first.
  const prefill = React.useMemo(
    () => (mounted ? prefillFrom(window.location.search) : {}),
    [mounted],
  );
  const savedCallsign = React.useMemo(() => (mounted ? loadIdentity().callsign : ""), [mounted]);
  const recent = React.useMemo(() => (mounted ? listRecentRooms() : []), [mounted]);
  const [teamPick, setTeam] = React.useState<Team | null>(null);
  const [mapPick, setMap] = React.useState<MapId | null>(null);
  const [zonePick, setZone] = React.useState<ControlZoneId | null>(null);
  const [squadMode, setSquadMode] = React.useState(false);
  const [access, setAccess] = React.useState<RoomSettings["drawAccess"]>("everyone");
  const [callsignPick, setCallsign] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | undefined>();
  const [from, setFrom] = React.useState("");
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const now = useNow(60_000, clockNow);
  const team: Team = teamPick ?? prefill.team ?? "Lonestar";
  const map: MapId = mapPick ?? prefill.map ?? "zestafona";
  const zone: ControlZoneId = zonePick ?? prefill.zone ?? "default";
  const callsign = callsignPick ?? savedCallsign;

  const recentForMap = recent.filter((r) => r.map === map);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CallsignSchema.safeParse(callsign);
    if (!parsed.success) {
      setError("2 to 24 characters.");
      return;
    }
    setError(undefined);
    setBusy(true);
    const identity = { ...loadIdentity(), callsign: parsed.data };
    saveIdentity(identity);
    const code = newRoomCode();
    const now = clockNow();
    let state = createRoomState({
      code,
      settings: {
        team,
        map,
        controlZone: zone,
        squadMode,
        squads: [...DEFAULT_SQUADS],
        drawAccess: access,
        mapSource: { kind: "builtin" },
      },
      createdAt: now,
      actor: identity.client,
    });
    const member: RosterMember = {
      id: identity.client,
      callsign: identity.callsign,
      role: "commander",
      focus: identity.focus,
      online: true,
      ink: identity.ink,
      canDraw: true,
      drawRequested: false,
      joinedAt: now,
      lastSeen: now,
    };
    state = {
      ...state,
      roster: { [identity.client]: member },
      revs: { ...state.revs, [`roster:${identity.client}`]: { seq: 2, actor: identity.client } },
      seq: 2,
    };
    if (from) {
      const src = loadRoom(from);
      if (src) {
        const nodes = { ...src.state.nodes };
        state = {
          ...state,
          nodes,
          order: Object.keys(nodes).sort(
            (a, b) => nodes[a].createdAt - nodes[b].createdAt || (a < b ? -1 : 1),
          ),
        };
        for (const id of Object.keys(nodes)) state.revs[id] = { seq: 2, actor: identity.client };
      }
    }
    saveRoom(code, { v: 1, state, savedAt: now });
    touchRecentRoom({ code, team, map, controlZone: zone, role: "commander", updatedAt: now });
    router.push(`/room/${code}`);
  };

  const teamVar = TEAM_VAR[team];

  return (
    <FormShell
      title="Open your team's war room"
      style={{ "--team": teamVar } as React.CSSProperties}
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-7"
        style={{ borderTop: "2px solid var(--team)", marginTop: -20, paddingTop: 20 }}
      >
        <div>
          <GroupLabel>Your team</GroupLabel>
          <div role="radiogroup" aria-label="Your team" className="grid grid-cols-3 gap-3">
            {site.game.teams.map((t) => {
              const selected = team === t;
              return (
                <button
                  key={t}
                  id={`team-${t.toLowerCase()}`}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTeam(t)}
                  style={{
                    borderTopColor: TEAM_VAR[t],
                    ...(selected
                      ? { background: `color-mix(in srgb, ${TEAM_VAR[t]} 12%, var(--bg-1))` }
                      : {}),
                  }}
                  className={cn(
                    "h-11 rounded-md border border-t-[3px] border-line-strong bg-bg-1 text-[15px] font-semibold text-fg-muted transition-colors hover:border-line-hi sm:h-14",
                    selected && `border-line-hi ${TEAM_TEXT[t]}`,
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <GroupLabel>Map</GroupLabel>
          <div role="radiogroup" aria-label="Map" className="grid grid-cols-3 gap-3">
            {MAP_LIST.map((m) => {
              const selected = map === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMap(m.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-md border border-line-strong bg-bg-0 text-left transition-colors hover:border-line-hi",
                    selected && "border-accent ring-2 ring-accent",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- immutable terrain SVG route */}
                  <img
                    src={terrainUrl(m.id, {
                      size: 320,
                      zone: selected ? zone : "none",
                      labels: false,
                    })}
                    alt={`${m.name} — ${m.blurb.replace(/\.$/, "").toLowerCase()}`}
                    width={320}
                    height={320}
                    className="aspect-square w-full object-cover"
                    style={selected ? { boxShadow: "inset 0 0 0 2px var(--team)" } : undefined}
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-0/95 to-transparent px-2 pt-6 pb-2">
                    <span className="block eyebrow">{m.name}</span>
                    <span className="mt-0.5 hidden text-[12px] leading-snug text-fg-muted sm:block">
                      {m.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <GroupLabel className="mb-0">Control zone</GroupLabel>
            <span className="text-right text-[13px] text-fg-muted">
              Change it any time under Manage
            </span>
          </div>
          <div role="radiogroup" aria-label="Control zone" className="flex flex-wrap gap-2">
            {CONTROL_ZONE_IDS.map((z) => (
              <Chip
                key={z}
                role="radio"
                aria-checked={zone === z}
                selected={zone === z}
                onClick={() => setZone(z)}
              >
                {CONTROL_ZONE_LABEL[z]}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <GroupLabel>Run squads?</GroupLabel>
          <RadioCards
            name="squadMode"
            aria-label="Run squads?"
            columns={2}
            value={squadMode ? "squads" : "shared"}
            onChange={(v) => setSquadMode(v === "squads")}
            options={[
              {
                value: "shared",
                title: "One shared map",
                body: "Everyone works on the same layer. Simple.",
              },
              {
                value: "squads",
                title: "Squad mode",
                body: "Each squad plans on its own layer. Only you and co-commanders mark the team map. Joiners are asked their squad.",
              },
            ]}
          />
        </div>

        <div>
          <GroupLabel>Who can draw and use the map?</GroupLabel>
          <RadioCards
            name="drawAccess"
            aria-label="Who can draw and use the map?"
            columns={2}
            value={access}
            onChange={setAccess}
            options={[
              {
                value: "everyone",
                title: "Everyone",
                body: "Anyone in the room draws and places every marker.",
              },
              {
                value: "request",
                title: "By request",
                body: "Only you and co-commanders. People ask from a greyed tool; you approve in the Roster.",
              },
            ]}
          />
        </div>

        <DiscordButton />
        <OrDivider />
        <CallsignField value={callsign} onChange={setCallsign} error={error} />

        {recentForMap.length ? (
          <div>
            <Label htmlFor="from-recent">Start from a recent plan</Label>
            <select
              id="from-recent"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-12 w-full rounded-md border border-line-strong bg-bg-1 px-3 text-[15px] text-fg"
            >
              <option value="">None</option>
              {recentForMap.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} · {mapById(r.map)?.name ?? r.map} · {timeAgo(r.updatedAt, now)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg-0/90 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Button
            type="submit"
            size="lg"
            loading={busy}
            className="w-full gap-2"
            style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--team) 40%, transparent)" }}
          >
            Open war room <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
        <p className="-mt-3 flex items-center justify-center gap-2 text-center text-[13px] text-fg-muted">
          <ShieldAlert size={14} aria-hidden="true" />
          Never share your war room code with another team.
        </p>
        <p className="-mt-5 text-center">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded-sm text-[14px] text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            How focus and map access work
          </button>
        </p>
        <noscript>
          <p className="text-center text-sm text-fg-muted">JavaScript is needed to open a room.</p>
        </noscript>
      </form>
      <FocusHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </FormShell>
  );
}
