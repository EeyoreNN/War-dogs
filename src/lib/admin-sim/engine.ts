import { site, type Team } from "@/config/site";
import { MAPS, MAP_LIST } from "@/config/maps";
import { CONTROL_ZONE_LABEL, MAP_IDS, type ControlZoneId, type MapId } from "@/lib/terrain/types";
import { botName, botSteamId } from "./names";
import { hash32, int, unit } from "./rng";
import {
  LIGHTINGS,
  type AdminCommand,
  type AuditEntry,
  type Lighting,
  type MatchRecord,
  type PlayerSession,
  type RconCall,
  type RotationEntry,
  type ScorePoint,
  type SimBan,
  type SimPlayer,
  type SimSettings,
  type SimState,
  type TimedCommand,
} from "./types";

export { botName } from "./names";

export const SIM_EPOCH = Date.UTC(2026, 8, 1, 4, 0, 0); // 2026-09-01T04:00Z
export const MATCH_MS = 40 * 60_000;
export const DEFAULT_SEED = 0x5741_5244; // "WARD"

export const SERVER_NAME = "Wardogs Demo Server";
export const EXPERIENCE = "King of the Hill";
export const MAX_PLAYERS = 100;
export const SCORE_CAP = 100;
export const HISTORY_MS = 72 * 3_600_000;
export const DAY_MS = 86_400_000;
export const BAN_DEFAULT_MIN = 60;
export const BAN_MAX_MIN = 360;
export const SCORE_TICK_RANGE: [number, number] = [18, 30];

const TEAMS = site.game.teams;
const BOT_POOL = 96;
const TIMELINE_STEP_MS = 120_000;
const KNOTS = 6;

export const DEFAULT_SETTINGS: SimSettings = {
  scoreTick: 24,
  rotationEnabled: true,
  rotationMode: "ordered",
};

export const DEFAULT_ROTATION: RotationEntry[] = [
  {
    map: "zestafona",
    experiences: [EXPERIENCE],
    lighting: "Day End Clear",
    zoneAlternator: "default",
    status: "",
    denied: false,
  },
  {
    map: "bakurani",
    experiences: [EXPERIENCE],
    lighting: "Day Clear",
    zoneAlternator: "small-factory",
    status: "",
    denied: false,
  },
  {
    map: "ozeti",
    experiences: [EXPERIENCE],
    lighting: "Dusk Overcast",
    zoneAlternator: "water-treatment",
    status: "",
    denied: false,
  },
];

/** Most recent 04:00Z at or before `nowMs`. Commands written before it are discarded. */
export function resetBoundary(nowMs: number): number {
  const d = new Date(nowMs);
  let b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4, 0, 0);
  if (b > nowMs) b -= DAY_MS;
  return b;
}

/** `YYYY-MM-DD` (UTC) of the reset boundary — the localStorage key suffix (§5.4). */
export function boundaryDate(nowMs: number): string {
  return new Date(resetBoundary(nowMs)).toISOString().slice(0, 10);
}

export function mapName(id: MapId): string {
  return MAPS[id].name;
}

export function zoneName(id: ControlZoneId): string {
  return CONTROL_ZONE_LABEL[id];
}

/* ───────────────────────────── schedule ───────────────────────────── */

interface Segment {
  n: number;
  startedAt: number;
  /** Actual end (scheduled end, or the `match.end` / `match.restart` instant). */
  endedAt: number;
  /** Scheduled end (`startedAt + MATCH_MS`). */
  endsAt: number;
  /** A `match.restart` threw this segment away; it never reaches history. */
  aborted: boolean;
}

interface Era {
  n0: number;
  t0: number;
  /** Exclusive end; Infinity for the live era. */
  until: number;
  endedBy: "end" | "restart" | null;
}

function buildEras(cmds: TimedCommand[]): Era[] {
  const eras: Era[] = [{ n0: 0, t0: SIM_EPOCH, until: Infinity, endedBy: null }];
  for (const c of cmds) {
    if (c.cmd.t !== "match.end" && c.cmd.t !== "match.restart") continue;
    const cur = eras[eras.length - 1];
    if (c.at < cur.t0) continue;
    const k = Math.floor((c.at - cur.t0) / MATCH_MS);
    const n = cur.n0 + k;
    cur.until = c.at;
    cur.endedBy = c.cmd.t === "match.end" ? "end" : "restart";
    eras.push({
      n0: c.cmd.t === "match.end" ? n + 1 : n,
      t0: c.at,
      until: Infinity,
      endedBy: null,
    });
  }
  return eras;
}

function segmentsBetween(eras: Era[], from: number, to: number): Segment[] {
  const out: Segment[] = [];
  for (const era of eras) {
    if (era.until <= from || era.t0 > to) continue;
    const k0 = Math.max(0, Math.floor((from - era.t0) / MATCH_MS));
    for (let k = k0; ; k++) {
      const startedAt = era.t0 + k * MATCH_MS;
      if (startedAt >= era.until || startedAt > to) break;
      const endsAt = startedAt + MATCH_MS;
      const cut = era.until < endsAt;
      out.push({
        n: era.n0 + k,
        startedAt,
        endedAt: cut ? era.until : endsAt,
        endsAt,
        aborted: cut && era.endedBy === "restart",
      });
    }
  }
  return out;
}

function currentSegment(eras: Era[], now: number): Segment {
  const era = eras[eras.length - 1];
  const k = Math.max(0, Math.floor((now - era.t0) / MATCH_MS));
  const startedAt = era.t0 + k * MATCH_MS;
  return {
    n: era.n0 + k,
    startedAt,
    endedAt: startedAt + MATCH_MS,
    endsAt: startedAt + MATCH_MS,
    aborted: false,
  };
}

/* ───────────────────────────── per-match world ───────────────────────────── */

interface BotSchedule {
  i: number;
  steamId: string;
  name: string;
  team: Team;
  joinAt: number;
  leaveAt: number;
  killRate: number; // per minute
  deathRate: number;
  pingBase: number;
}

interface World {
  seed: number;
  n: number;
  startedAt: number;
  endedAt: number;
  endsAt: number;
  winner: Team;
  /** Final score each team would reach at the scheduled end. */
  target: Record<Team, number>;
  /** Cumulative curve knots per team (fraction of target at fraction i/KNOTS of the match). */
  knots: Record<Team, number[]>;
  bots: BotSchedule[];
  timeline: ScorePoint[];
  final: Record<Team, number>;
  finalWinner: Team;
}

const worldCache = new Map<string, World>();
const WORLD_CACHE_MAX = 512;

function scoreAt(w: World, team: Team, t: number): number {
  const frac = Math.min(1, Math.max(0, (t - w.startedAt) / MATCH_MS));
  const pos = frac * KNOTS;
  const i = Math.min(KNOTS - 1, Math.floor(pos));
  const k = w.knots[team];
  const a = k[i];
  const b = k[i + 1];
  const v = a + (b - a) * (pos - i);
  return Math.min(SCORE_CAP, Math.floor(v * w.target[team]));
}

function scoresAt(w: World, t: number): Record<Team, number> {
  return {
    Lonestar: scoreAt(w, "Lonestar", t),
    Valkyra: scoreAt(w, "Valkyra", t),
    Manticore: scoreAt(w, "Manticore", t),
  };
}

function argmax(s: Record<Team, number>): Team {
  let best: Team = TEAMS[0];
  for (const t of TEAMS) if (s[t] > s[best]) best = t;
  return best;
}

function buildWorld(seed: number, seg: Segment): World {
  const { n, startedAt, endedAt, endsAt } = seg;
  const winner = TEAMS[hash32(seed, n, 1) % 3];
  const target = { Lonestar: 0, Valkyra: 0, Manticore: 0 } as Record<Team, number>;
  const knots = {} as Record<Team, number[]>;
  TEAMS.forEach((team, ti) => {
    target[team] = team === winner ? SCORE_CAP : int(40, 95, seed, n, 2, ti);
    // Monotone cumulative curve: random positive increments, normalised to end at 1.
    const inc: number[] = [];
    let sum = 0;
    for (let k = 0; k < KNOTS; k++) {
      const v = 0.35 + unit(seed, n, 3, ti, k) * 1.3;
      inc.push(v);
      sum += v;
    }
    const cum = [0];
    let acc = 0;
    for (const v of inc) {
      acc += v / sum;
      cum.push(Math.min(1, acc));
    }
    cum[KNOTS] = 1;
    knots[team] = cum;
  });

  const count = 13 + Math.floor(unit(seed, n, 4) * 28); // 13..40
  const start = hash32(seed, n, 5) % BOT_POOL;
  const teamShift = hash32(seed, n, 6) % 3;
  const bots: BotSchedule[] = [];
  for (let j = 0; j < count; j++) {
    const i = (start + j * 7) % BOT_POOL;
    const core = j < 13;
    const joinAt = core
      ? startedAt + j * 1_500
      : startedAt + Math.floor(unit(seed, n, 7, j) * 0.7 * MATCH_MS);
    const stay = core ? MATCH_MS : Math.floor((0.2 + 0.8 * unit(seed, n, 8, j)) * MATCH_MS);
    bots.push({
      i,
      steamId: botSteamId(seed, i),
      name: botName(seed, i),
      team: TEAMS[(j + teamShift) % 3],
      joinAt,
      leaveAt: Math.min(endsAt, joinAt + stay),
      killRate: 0.25 + unit(seed, i, 9) * 1.15,
      deathRate: 0.2 + unit(seed, i, 10) * 1.0,
      pingBase: 18 + Math.floor(unit(seed, i, 11) * 122),
    });
  }

  const w: World = {
    seed,
    n,
    startedAt,
    endedAt,
    endsAt,
    winner,
    target,
    knots,
    bots,
    timeline: [],
    final: target,
    finalWinner: winner,
  };
  const timeline: ScorePoint[] = [];
  for (let t = startedAt; t < endedAt; t += TIMELINE_STEP_MS)
    timeline.push({ t, scores: scoresAt(w, t) });
  timeline.push({ t: endedAt, scores: scoresAt(w, endedAt) });
  w.timeline = timeline;
  w.final = scoresAt(w, endedAt);
  w.finalWinner = argmax(w.final);
  return w;
}

function worldFor(seed: number, seg: Segment): World {
  const key = `${seed}:${seg.n}:${seg.startedAt}:${seg.endedAt}`;
  const hit = worldCache.get(key);
  if (hit) return hit;
  if (worldCache.size >= WORLD_CACHE_MAX) worldCache.clear();
  const w = buildWorld(seed, seg);
  worldCache.set(key, w);
  return w;
}

function botStats(b: BotSchedule, seconds: number, extraDeaths: number) {
  const minutes = seconds / 60;
  const kills = Math.floor(b.killRate * minutes);
  const deaths = Math.floor(b.deathRate * minutes) + extraDeaths;
  const cash = Math.max(0, 400 + kills * 120 - deaths * 35 + Math.floor(minutes * 18));
  return { kills, deaths, cash };
}

function pingAt(b: BotSchedule, t: number): number {
  const minute = Math.floor(t / 60_000);
  return b.pingBase + Math.round(6 * Math.sin(minute * 0.9 + b.i));
}

/* ───────────────────────────── rotation ───────────────────────────── */

function applyRotationCmd(
  list: RotationEntry[],
  cmd: AdminCommand,
): { list: RotationEntry[]; ok: boolean; detail: string } {
  switch (cmd.t) {
    case "rotation.add":
      return {
        list: [
          ...list,
          { ...cmd.entry, experiences: [...cmd.entry.experiences], status: "", denied: false },
        ],
        ok: true,
        detail: `${mapName(cmd.entry.map)} · ${zoneName(cmd.entry.zoneAlternator)} · ${cmd.entry.lighting}`,
      };
    case "rotation.remove": {
      if (cmd.index < 0 || cmd.index >= list.length)
        return { list, ok: false, detail: `no entry at index ${cmd.index}` };
      if (list.length === 1)
        return { list, ok: false, detail: "the rotation needs at least one entry" };
      const e = list[cmd.index];
      return {
        list: list.filter((_, i) => i !== cmd.index),
        ok: true,
        detail: `${mapName(e.map)} removed from slot ${cmd.index + 1}`,
      };
    }
    case "rotation.move": {
      const j = cmd.direction === "up" ? cmd.index - 1 : cmd.index + 1;
      if (cmd.index < 0 || cmd.index >= list.length || j < 0 || j >= list.length)
        return { list, ok: false, detail: `cannot move entry ${cmd.index + 1} ${cmd.direction}` };
      const next = [...list];
      [next[cmd.index], next[j]] = [next[j], next[cmd.index]];
      return {
        list: next,
        ok: true,
        detail: `${mapName(list[cmd.index].map)} moved ${cmd.direction} to slot ${j + 1}`,
      };
    }
    default:
      return { list, ok: true, detail: "" };
  }
}

function rotationAt(cmds: TimedCommand[], t: number): RotationEntry[] {
  let list = DEFAULT_ROTATION;
  for (const c of cmds) {
    if (c.at > t) break;
    if (
      c.cmd.t === "rotation.add" ||
      c.cmd.t === "rotation.remove" ||
      c.cmd.t === "rotation.move"
    ) {
      const r = applyRotationCmd(list, c.cmd);
      if (r.ok) list = r.list;
    }
  }
  return list;
}

function settingsAt(cmds: TimedCommand[], t: number): SimSettings {
  let s = DEFAULT_SETTINGS;
  for (const c of cmds) {
    if (c.at > t) break;
    if (c.cmd.t === "settings.patch" && settingsPatchOk(c.cmd.patch)) s = { ...s, ...c.cmd.patch };
  }
  return s;
}

function settingsPatchOk(p: Partial<SimSettings>): boolean {
  if (
    p.scoreTick !== undefined &&
    (!Number.isInteger(p.scoreTick) ||
      p.scoreTick < SCORE_TICK_RANGE[0] ||
      p.scoreTick > SCORE_TICK_RANGE[1])
  )
    return false;
  if (p.rotationMode !== undefined && p.rotationMode !== "ordered" && p.rotationMode !== "random")
    return false;
  if (p.rotationEnabled !== undefined && typeof p.rotationEnabled !== "boolean") return false;
  return true;
}

function rotationIndexFor(
  seed: number,
  n: number,
  list: RotationEntry[],
  mode: SimSettings["rotationMode"],
): number {
  if (list.length === 0) return 0;
  return mode === "random" ? hash32(seed, n, 12) % list.length : n % list.length;
}

interface MatchContext {
  map: MapId;
  zone: ControlZoneId;
  lighting: Lighting;
  rotationIndex: number;
}

/* ───────────────────────────── commands as perturbations ───────────────────────────── */

interface Perturbations {
  kicks: { steamId: string; at: number; returnAt: number }[];
  bans: (SimBan & { placedAt: number })[];
  moves: { steamId: string; team: Team; matchN: number; at: number }[];
  kills: { steamId: string; matchN: number }[];
  mapOverrides: {
    matchN: number;
    at: number;
    map: MapId;
    zone: ControlZoneId;
    lighting: Lighting | null;
  }[];
  lightingOverrides: { matchN: number; at: number; value: Lighting }[];
  reserved: string[];
  broadcastLog: { at: number; text: string; to: string | null }[];
  audit: AuditEntry[];
}

function contextFor(
  seed: number,
  seg: Segment,
  cmds: TimedCommand[],
  p: Perturbations,
  at: number,
): MatchContext {
  const list = rotationAt(cmds, seg.startedAt);
  const settings = settingsAt(cmds, seg.startedAt);
  const idx = rotationIndexFor(seed, seg.n, list, settings.rotationMode);
  const entry = list[idx] ?? DEFAULT_ROTATION[seg.n % DEFAULT_ROTATION.length];
  let ctx: MatchContext = {
    map: entry.map,
    zone: entry.zoneAlternator,
    lighting: entry.lighting,
    rotationIndex: idx,
  };
  for (const o of p.mapOverrides) {
    if (o.matchN === seg.n && o.at <= at)
      ctx = { ...ctx, map: o.map, zone: o.zone, lighting: o.lighting ?? ctx.lighting };
  }
  for (const o of p.lightingOverrides) {
    if (o.matchN === seg.n && o.at <= at) ctx = { ...ctx, lighting: o.value };
  }
  return ctx;
}

function isKickedAt(p: Perturbations, steamId: string, t: number): boolean {
  return p.kicks.some((k) => k.steamId === steamId && t >= k.at && t < k.returnAt);
}

function isBannedAt(p: Perturbations, steamId: string, t: number): boolean {
  return p.bans.some((b) => b.steamId === steamId && t >= b.placedAt && t < b.expiresAt);
}

function botAt(w: World, steamId: string): BotSchedule | undefined {
  return w.bots.find((b) => b.steamId === steamId);
}

function presentAt(w: World, p: Perturbations, b: BotSchedule, t: number): boolean {
  return (
    t >= b.joinAt && t < b.leaveAt && !isKickedAt(p, b.steamId, t) && !isBannedAt(p, b.steamId, t)
  );
}

function teamAt(p: Perturbations, b: BotSchedule, matchN: number, t: number): Team {
  let team = b.team;
  for (const m of p.moves)
    if (m.steamId === b.steamId && m.matchN === matchN && m.at <= t) team = m.team;
  return team;
}

function killsFor(p: Perturbations, steamId: string, matchN: number): number {
  let n = 0;
  for (const k of p.kills) if (k.steamId === steamId && k.matchN === matchN) n++;
  return n;
}

function playerAt(w: World, p: Perturbations, b: BotSchedule, t: number): SimPlayer {
  const seconds = (t - b.joinAt) / 1000;
  const stats = botStats(b, seconds, killsFor(p, b.steamId, w.n));
  return {
    steamId: b.steamId,
    name: b.name,
    team: teamAt(p, b, w.n, t),
    joinedAt: b.joinAt,
    kills: stats.kills,
    deaths: stats.deaths,
    cash: stats.cash,
    pingMs: pingAt(b, t),
  };
}

const NAME_LOOKUP = new Map<number, Map<string, string>>();
function nameOf(seed: number, steamId: string): string | null {
  let m = NAME_LOOKUP.get(seed);
  if (!m) {
    m = new Map();
    for (let i = 0; i < BOT_POOL; i++) m.set(botSteamId(seed, i), botName(seed, i));
    NAME_LOOKUP.set(seed, m);
  }
  return m.get(steamId) ?? null;
}

function quote(s: string): string {
  return `"${s.replace(/\s+/g, " ").trim()}"`;
}

function applyCommands(
  seed: number,
  cmds: TimedCommand[],
  eras: Era[],
  me: string,
): { p: Perturbations; rotation: RotationEntry[]; settings: SimSettings } {
  const p: Perturbations = {
    kicks: [],
    bans: [],
    moves: [],
    kills: [],
    mapOverrides: [],
    lightingOverrides: [],
    reserved: [],
    broadcastLog: [],
    audit: [],
  };
  let rotation = DEFAULT_ROTATION;
  let settings = DEFAULT_SETTINGS;

  const push = (c: TimedCommand, target: string | null, ok: boolean, detail: string) => {
    p.audit.push({
      id: c.id,
      at: c.at,
      actor: c.actor,
      mine: c.actor === me,
      action: c.cmd.t,
      target,
      result: ok ? "ok" : "refused",
      detail,
      rcon: toRcon(c.cmd),
    });
  };

  for (const c of cmds) {
    const cmd = c.cmd;
    // A match.end / match.restart is audited against the match it ended, not the one it started.
    const probe = cmd.t === "match.end" || cmd.t === "match.restart" ? c.at - 1 : c.at;
    const seg = segmentsBetween(eras, probe, probe)[0] ?? currentSegment(eras, probe);
    const w = worldFor(seed, seg);

    const target = (steamId: string) => {
      const b = botAt(w, steamId);
      const name = b?.name ?? nameOf(seed, steamId) ?? steamId;
      const present = Boolean(b && presentAt(w, p, b, c.at));
      return { b, name, present };
    };

    switch (cmd.t) {
      case "kick": {
        const { name, present } = target(cmd.steamId);
        if (!present) {
          push(c, name, false, `${name} is not on the server`);
          break;
        }
        const returnAt = c.at + int(90, 300, seed, c.at % 2147483647, 13) * 1000;
        p.kicks.push({ steamId: cmd.steamId, at: c.at, returnAt });
        push(c, name, true, quote(cmd.reason));
        break;
      }
      case "kill": {
        const { name, present } = target(cmd.steamId);
        if (!present) {
          push(c, name, false, `${name} is not on the server`);
          break;
        }
        p.kills.push({ steamId: cmd.steamId, matchN: seg.n });
        push(c, name, true, "killed in-match");
        break;
      }
      case "ban": {
        const { name } = target(cmd.steamId);
        if (isBannedAt(p, cmd.steamId, c.at)) {
          push(c, name, false, `${name} is already banned`);
          break;
        }
        const minutes = Math.min(
          BAN_MAX_MIN,
          Math.max(1, Math.round(cmd.minutes || BAN_DEFAULT_MIN)),
        );
        p.bans.push({
          steamId: cmd.steamId,
          name,
          bannedAtUtc: new Date(c.at).toISOString(),
          bannedBy: c.actor,
          reason: cmd.reason,
          evidenceUrl: cmd.evidenceUrl,
          expiresAt: c.at + minutes * 60_000,
          placedAt: c.at,
        });
        push(
          c,
          name,
          true,
          `${quote(cmd.reason)} · ${minutes} min${cmd.evidenceUrl ? " · evidence attached" : ""}`,
        );
        break;
      }
      case "unban": {
        const { name } = target(cmd.steamId);
        const ban = p.bans.find(
          (b) => b.steamId === cmd.steamId && c.at >= b.placedAt && c.at < b.expiresAt,
        );
        if (!ban) {
          push(c, name, false, `${name} is not banned`);
          break;
        }
        ban.expiresAt = c.at;
        push(c, name, true, "ban lifted");
        break;
      }
      case "move": {
        const { b, name, present } = target(cmd.steamId);
        if (!present || !b) {
          push(c, name, false, `${name} is not on the server`);
          break;
        }
        if (!TEAMS.includes(cmd.team)) {
          push(c, name, false, `unknown faction ${String(cmd.team)}`);
          break;
        }
        const from = teamAt(p, b, seg.n, c.at);
        if (from === cmd.team) {
          push(c, name, false, `${name} is already on ${cmd.team}`);
          break;
        }
        p.moves.push({ steamId: cmd.steamId, team: cmd.team, matchN: seg.n, at: c.at });
        push(c, name, true, `${from} → ${cmd.team}`);
        break;
      }
      case "whisper": {
        const { name, present } = target(cmd.steamId);
        if (!present) {
          push(c, name, false, `${name} is not on the server`);
          break;
        }
        p.broadcastLog.push({ at: c.at, text: cmd.text, to: name });
        push(c, name, true, quote(cmd.text));
        break;
      }
      case "broadcast":
        p.broadcastLog.push({ at: c.at, text: cmd.text, to: null });
        push(c, null, true, quote(cmd.text));
        break;
      case "map.set": {
        if (!MAP_IDS.includes(cmd.map)) {
          push(c, String(cmd.map), false, `unknown map ${String(cmd.map)}`);
          break;
        }
        p.mapOverrides.push({
          matchN: seg.n,
          at: c.at,
          map: cmd.map,
          zone: cmd.zone,
          lighting: cmd.lighting,
        });
        push(
          c,
          mapName(cmd.map),
          true,
          `${zoneName(cmd.zone)}${cmd.lighting ? ` · ${cmd.lighting}` : ""} · until the next match`,
        );
        break;
      }
      case "match.end":
        push(c, `Match ${seg.n}`, true, `ended at ${new Date(c.at).toISOString().slice(11, 19)}Z`);
        break;
      case "match.restart":
        push(c, `Match ${seg.n}`, true, "restarted from zero");
        break;
      case "lighting.set": {
        if (!LIGHTINGS.includes(cmd.value)) {
          push(c, String(cmd.value), false, `unknown lighting ${String(cmd.value)}`);
          break;
        }
        p.lightingOverrides.push({ matchN: seg.n, at: c.at, value: cmd.value });
        push(c, cmd.value, true, "until the next rotation entry");
        break;
      }
      case "rotation.add":
      case "rotation.remove":
      case "rotation.move": {
        const r = applyRotationCmd(rotation, cmd);
        if (r.ok) rotation = r.list;
        push(c, "Rotation", r.ok, r.detail);
        break;
      }
      case "rotation.save":
        push(
          c,
          "Rotation",
          true,
          `${rotation.length} entries written to ServerSettings.ini (simulated)`,
        );
        break;
      case "reserved.add":
        if (p.reserved.includes(cmd.steamId)) {
          push(c, nameOf(seed, cmd.steamId) ?? cmd.steamId, false, "already reserved");
          break;
        }
        p.reserved.push(cmd.steamId);
        push(c, nameOf(seed, cmd.steamId) ?? cmd.steamId, true, "slot reserved");
        break;
      case "reserved.remove": {
        const i = p.reserved.indexOf(cmd.steamId);
        if (i < 0) {
          push(c, nameOf(seed, cmd.steamId) ?? cmd.steamId, false, "no reserved slot");
          break;
        }
        p.reserved.splice(i, 1);
        push(c, nameOf(seed, cmd.steamId) ?? cmd.steamId, true, "slot released");
        break;
      }
      case "settings.patch": {
        const ok = settingsPatchOk(cmd.patch);
        if (ok) settings = { ...settings, ...cmd.patch };
        push(
          c,
          "Settings",
          ok,
          ok
            ? Object.entries(cmd.patch)
                .map(([k, v]) => `${k} = ${String(v)}`)
                .join(" · ")
            : `scoreTick must be ${SCORE_TICK_RANGE[0]}–${SCORE_TICK_RANGE[1]} and mode ordered or random`,
        );
        break;
      }
      case "reset":
        push(c, null, true, "local only — every visitor command before this was discarded");
        break;
    }
  }
  return { p, rotation, settings };
}

/* ───────────────────────────── public API ───────────────────────────── */

/** Commands that count: at or after the reset boundary, and after the last `reset`. */
export function effectiveCommands(commands: TimedCommand[], nowMs: number): TimedCommand[] {
  const boundary = resetBoundary(nowMs);
  const sorted = commands
    .filter((c) => c.at >= boundary && c.at <= nowMs)
    .slice()
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  let lastReset = -1;
  sorted.forEach((c, i) => {
    if (c.cmd.t === "reset") lastReset = i;
  });
  return lastReset < 0 ? sorted : sorted.slice(lastReset);
}

/** The whole simulated server at `nowMs`: pure, deterministic, O(players + commands + history). */
export function stateAt(
  seed: number,
  nowMs: number,
  commands: TimedCommand[],
  me: string,
): SimState {
  const cmds = effectiveCommands(commands, nowMs);
  const eras = buildEras(cmds);
  const { p, rotation, settings } = applyCommands(seed, cmds, eras, me);

  const cur = currentSegment(eras, nowMs);
  const world = worldFor(seed, cur);
  const ctx = contextFor(seed, cur, cmds, p, nowMs);

  const players: SimPlayer[] = [];
  for (const b of world.bots)
    if (presentAt(world, p, b, nowMs)) players.push(playerAt(world, p, b, nowMs));

  const windowStart = nowMs - HISTORY_MS;
  const past = segmentsBetween(eras, windowStart, nowMs).filter(
    (s) => !s.aborted && s.endedAt <= nowMs && s.endedAt >= windowStart,
  );

  const history: MatchRecord[] = [];
  const sessions: PlayerSession[] = [];
  const serverAudit: AuditEntry[] = [];
  for (const seg of past) {
    const w = worldFor(seed, seg);
    const c = contextFor(seed, seg, cmds, p, seg.endedAt);
    history.push({
      n: seg.n,
      map: c.map,
      zone: c.zone,
      lighting: c.lighting,
      startedAt: seg.startedAt,
      endedAt: seg.endedAt,
      final: w.final,
      winner: w.finalWinner,
      timeline: w.timeline,
      players: w.bots
        .filter((b) => b.joinAt < seg.endedAt)
        .map((b) => {
          const to = Math.min(b.leaveAt, seg.endedAt);
          const seconds = Math.max(0, (to - b.joinAt) / 1000);
          const stats = botStats(b, seconds, killsFor(p, b.steamId, seg.n));
          return {
            steamId: b.steamId,
            name: b.name,
            team: teamAt(p, b, seg.n, to),
            kills: stats.kills,
            deaths: stats.deaths,
            seconds: Math.floor(seconds),
          };
        }),
    });
    for (const b of w.bots) {
      if (b.joinAt >= seg.endedAt) continue;
      sessions.push({
        steamId: b.steamId,
        name: b.name,
        from: b.joinAt,
        to: Math.min(b.leaveAt, seg.endedAt),
        matchN: seg.n,
      });
    }
    serverAudit.push({
      id: `server-${seg.n}-${seg.endedAt}`,
      at: seg.endedAt,
      actor: "server",
      mine: false,
      action: "match.end",
      target: `Match ${seg.n}`,
      result: "ok",
      detail: `${mapName(c.map)} · ${w.finalWinner} ${w.final[w.finalWinner]} · ${TEAMS.filter(
        (t) => t !== w.finalWinner,
      )
        .map((t) => `${t} ${w.final[t]}`)
        .join(" · ")}`,
      rcon: null,
    });
  }
  for (const b of world.bots) {
    if (b.joinAt > nowMs) continue;
    sessions.push({
      steamId: b.steamId,
      name: b.name,
      from: b.joinAt,
      to: Math.min(b.leaveAt, nowMs),
      matchN: cur.n,
    });
  }
  history.reverse();

  const audit = [...p.audit, ...serverAudit].sort(
    (a, b) => b.at - a.at || a.id.localeCompare(b.id),
  );

  const rotationIndex = ctx.rotationIndex;
  const rotationList = rotation.map((e, i) => ({
    ...e,
    status:
      i === rotationIndex
        ? "now"
        : i === (rotationIndex + 1) % Math.max(1, rotation.length) && rotation.length > 1
          ? "next"
          : "",
  })) as RotationEntry[];

  const bans = p.bans
    .filter((b) => b.expiresAt > nowMs)
    .map((b): SimBan => ({
      steamId: b.steamId,
      name: b.name,
      bannedAtUtc: b.bannedAtUtc,
      bannedBy: b.bannedBy,
      reason: b.reason,
      evidenceUrl: b.evidenceUrl,
      expiresAt: b.expiresAt,
    }))
    .sort((a, b) => a.expiresAt - b.expiresAt);

  return {
    seed,
    now: nowMs,
    serverName: SERVER_NAME,
    map: ctx.map,
    zone: ctx.zone,
    mode: "King of the Hill",
    lighting: ctx.lighting,
    scores: scoresAt(world, nowMs),
    scoreCap: SCORE_CAP,
    settings,
    players,
    maxPlayers: MAX_PLAYERS,
    match: { n: cur.n, startedAt: cur.startedAt, endsAt: cur.endsAt },
    rotation: rotationList,
    rotationIndex,
    bans,
    reserved: [...p.reserved],
    history,
    sessions,
    audit,
    broadcastLog: p.broadcastLog,
  };
}

/** The exact HTTP call from `openapi.json` that a real server would receive; null for `reset`. */
export function toRcon(cmd: AdminCommand): RconCall | null {
  const id = (s: string) => encodeURIComponent(s);
  switch (cmd.t) {
    case "kick":
      return {
        method: "POST",
        path: `/v1/players/${id(cmd.steamId)}/kick`,
        body: { reason: cmd.reason },
      };
    case "kill":
      return { method: "POST", path: `/v1/players/${id(cmd.steamId)}/kill`, body: null };
    case "ban":
      return {
        method: "POST",
        path: "/v1/bans",
        body: { steamId: cmd.steamId, reason: cmd.reason },
      };
    case "unban":
      return { method: "DELETE", path: `/v1/bans/${id(cmd.steamId)}`, body: null };
    case "move":
      return {
        method: "PATCH",
        path: `/v1/players/${id(cmd.steamId)}`,
        body: { faction: cmd.team },
      };
    case "whisper":
      return {
        method: "POST",
        path: `/v1/players/${id(cmd.steamId)}/message`,
        body: { message: cmd.text },
      };
    case "broadcast":
      return { method: "POST", path: "/v1/broadcast", body: { message: cmd.text } };
    case "map.set":
      return {
        method: "POST",
        path: "/v1/match/map",
        body: {
          map: cmd.map,
          experiences: [EXPERIENCE],
          zoneAlternator: cmd.zone,
          ...(cmd.lighting ? { lighting: cmd.lighting } : {}),
        },
      };
    case "match.end":
      return { method: "POST", path: "/v1/match/end", body: null };
    case "match.restart":
      return { method: "POST", path: "/v1/match/restart", body: null };
    case "lighting.set":
      return { method: "PUT", path: "/v1/world/lighting", body: { lighting: cmd.value } };
    case "rotation.add":
      return {
        method: "POST",
        path: "/v1/rotation/entries",
        body: {
          map: cmd.entry.map,
          experiences: cmd.entry.experiences,
          lighting: cmd.entry.lighting,
          zoneAlternator: cmd.entry.zoneAlternator,
        },
      };
    case "rotation.remove":
      return { method: "DELETE", path: `/v1/rotation/entries/${cmd.index}`, body: null };
    case "rotation.move":
      return {
        method: "POST",
        path: `/v1/rotation/entries/${cmd.index}/move`,
        body: { direction: cmd.direction },
      };
    case "rotation.save":
      return { method: "POST", path: "/v1/rotation/save", body: null };
    case "reserved.add":
      return { method: "POST", path: "/v1/reserved-slots", body: { steamId: cmd.steamId } };
    case "reserved.remove":
      return { method: "DELETE", path: `/v1/reserved-slots/${id(cmd.steamId)}`, body: null };
    case "settings.patch":
      return { method: "PATCH", path: "/v1/settings", body: cmd.patch };
    case "reset":
      return null;
  }
}

/** All maps the simulator knows, for pickers and the catalog endpoint. */
export const SIM_MAPS = MAP_LIST.map((m) => ({ id: m.id, name: m.name }));
