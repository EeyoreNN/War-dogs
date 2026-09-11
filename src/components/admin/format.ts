import type { Team } from "@/config/site";

/** Team identity colours (team pickers, scoreboard columns, roster dots — never map markers). */
export const TEAM_TEXT: Record<Team, string> = {
  Lonestar: "text-lonestar",
  Valkyra: "text-valkyra",
  Manticore: "text-manticore",
};
export const TEAM_BG: Record<Team, string> = {
  Lonestar: "bg-lonestar",
  Valkyra: "bg-valkyra",
  Manticore: "bg-manticore",
};
export const TEAM_STROKE: Record<Team, string> = {
  Lonestar: "var(--team-lonestar)",
  Valkyra: "var(--team-valkyra)",
  Manticore: "var(--team-manticore)",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** `1:01:06` style clock from milliseconds (h shown only when non-zero). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** `12:04:31` local wall-clock time. */
export function timeOfDay(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** `Thu 11 Sep` style day label. */
export function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** `2h 14m` / `38m` / `45s` durations for playtime and countdowns. */
export function humanDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${pad(m % 60)}m`;
}

export function kd(kills: number, deaths: number): string {
  return deaths === 0 ? kills.toFixed(2) : (kills / deaths).toFixed(2);
}

/** Distinct players seen since the start of the UTC day. */
export function rosterToday(
  sessions: { steamId: string; from: number; to: number }[],
  now: number,
): number {
  const d = new Date(now);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const seen = new Set<string>();
  for (const s of sessions) if (s.to >= dayStart) seen.add(s.steamId);
  return seen.size;
}
