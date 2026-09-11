// Roster rules (§3.4). `online` is derived: every rule takes presence + now.
import {
  FOCUSES,
  IDLE_AFTER_MS,
  ONLINE_TTL_MS,
  PEER_TTL_MS,
  type ClientId,
  type Focus,
  type LayerId,
  type Presence,
  type RoomSettings,
  type RosterMember,
} from "./types";

/** Presence within ONLINE_TTL_MS → true; older presence → false; no record → the persisted flag. */
export function isOnline(m: RosterMember, presence: Presence | undefined, now: number): boolean {
  if (presence === undefined) return m.online;
  return now - presence.seenAt < ONLINE_TTL_MS;
}

export function isCommand(m: RosterMember | null): boolean {
  return m !== null && (m.role === "commander" || m.role === "co-commander");
}

/** everyone → true; request → command roles or the member's own canDraw flag. */
export function canDraw(m: RosterMember | null, s: RoomSettings): boolean {
  if (s.drawAccess === "everyone") return true;
  if (m === null) return false;
  return isCommand(m) || m.canDraw;
}

const emptyTally = (): Record<Focus, number> => {
  const t = {} as Record<Focus, number>;
  for (const f of FOCUSES) t[f] = 0;
  return t;
};

/** Online members only. */
export function focusTally(
  roster: RosterMember[],
  presence: Record<string, Presence>,
  now: number,
): Record<Focus, number> {
  const t = emptyTally();
  for (const m of roster) {
    if (m.focus === null) continue;
    if (!isOnline(m, presence[m.id], now)) continue;
    t[m.focus] += 1;
  }
  return t;
}

/** "No pilot in room" / "No medic in room" — the two gaps a commander must not miss. */
export function focusWarnings(t: Record<Focus, number>): string[] {
  const out: string[] = [];
  if (t.pilot === 0) out.push("No pilot in room");
  if (t.medic === 0) out.push("No medic in room");
  return out;
}

export function visibleLayers(s: RoomSettings, m: RosterMember | null): LayerId[] {
  if (!s.squadMode) return ["team"];
  if (isCommand(m)) return ["team", ...s.squads.map((q): LayerId => `squad:${q}`)];
  const squad = m?.squad ?? s.squads[0];
  return squad ? ["team", `squad:${squad}`] : ["team"];
}

export function editableLayer(s: RoomSettings, m: RosterMember | null): LayerId {
  if (!s.squadMode || isCommand(m)) return "team";
  const squad = m?.squad ?? s.squads[0];
  return squad ? `squad:${squad}` : "team";
}

/** No op or non-null cursor from that client within IDLE_AFTER_MS. */
export function isIdle(lastActiveAt: number | undefined, now: number): boolean {
  if (lastActiveAt === undefined) return true;
  return now - lastActiveAt >= IDLE_AFTER_MS;
}

const byJoined = (a: RosterMember, b: RosterMember) =>
  a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Earliest-joined online co-commander, else earliest-joined online member, excluding `leaving`. */
export function successor(
  roster: RosterMember[],
  presence: Record<string, Presence>,
  now: number,
  leaving: ClientId,
): RosterMember | null {
  const online = roster
    .filter((m) => m.id !== leaving && isOnline(m, presence[m.id], now))
    .sort(byJoined);
  return (
    online.find((m) => m.role === "co-commander") ?? online.find((m) => m.role === "member") ?? null
  );
}

/** Lowest client id among members with presence within PEER_TTL_MS (self included). */
export function singleWriter(
  roster: RosterMember[],
  presence: Record<string, Presence>,
  now: number,
): ClientId | null {
  let best: ClientId | null = null;
  for (const m of roster) {
    const p = presence[m.id];
    if (!p || now - p.seenAt >= PEER_TTL_MS) continue;
    if (best === null || m.id < best) best = m.id;
  }
  return best;
}

/** Flag still true but no presence for ONLINE_TTL_MS — what the single-writer flips to online:false. */
export function staleMembers(
  roster: RosterMember[],
  presence: Record<string, Presence>,
  now: number,
): RosterMember[] {
  return roster.filter((m) => m.online && !isOnline(m, presence[m.id], now));
}
