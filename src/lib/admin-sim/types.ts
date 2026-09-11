import type { Team } from "@/config/site";
import type { ControlZoneId, MapId } from "@/lib/terrain/types";

export const LIGHTINGS = ["Day Clear", "Day End Clear", "Dusk Overcast", "Night Clear"] as const;
export type Lighting = (typeof LIGHTINGS)[number];
export interface SimPlayer { steamId: string; name: string; team: Team; joinedAt: number; kills: number; deaths: number; cash: number; pingMs: number }
export interface SimBan { steamId: string; name: string; bannedAtUtc: string; bannedBy: string; reason: string; evidenceUrl: string | null; expiresAt: number }
export interface RotationEntry { map: MapId; experiences: string[]; lighting: Lighting; zoneAlternator: ControlZoneId; status: "now" | "next" | ""; denied: boolean }
export interface ScorePoint { t: number; scores: Record<Team, number> }
export interface MatchRecord { n: number; map: MapId; zone: ControlZoneId; lighting: Lighting; startedAt: number; endedAt: number; final: Record<Team, number>; winner: Team; timeline: ScorePoint[]; players: { steamId: string; name: string; team: Team; kills: number; deaths: number; seconds: number }[] }
export interface PlayerSession { steamId: string; name: string; from: number; to: number; matchN: number }
export interface AuditEntry { id: string; at: number; actor: string; mine: boolean; action: AdminCommand["t"]; target: string | null; result: "ok" | "refused"; detail: string; rcon: RconCall | null }
export interface RconCall { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body: unknown | null; contentType?: "application/json" | "text/plain" }
export interface SimSettings { scoreTick: number; rotationEnabled: boolean; rotationMode: "ordered" | "random" }
export interface SimState {
  seed: number; now: number; serverName: string; map: MapId; zone: ControlZoneId; mode: "King of the Hill"; lighting: Lighting;
  scores: Record<Team, number>; scoreCap: number; settings: SimSettings;
  players: SimPlayer[]; maxPlayers: number;
  match: { n: number; startedAt: number; endsAt: number };
  rotation: RotationEntry[]; rotationIndex: number;
  bans: SimBan[]; reserved: string[];
  history: MatchRecord[];          // most recent first, 72 h
  sessions: PlayerSession[];       // 72 h
  audit: AuditEntry[];             // most recent first
  broadcastLog: { at: number; text: string; to: string | null }[];
}
export type AdminCommand =
  | { t: "kick"; steamId: string; reason: string }
  | { t: "kill"; steamId: string }
  | { t: "ban"; steamId: string; reason: string; evidenceUrl: string | null; minutes: number }
  | { t: "unban"; steamId: string }
  | { t: "move"; steamId: string; team: Team }
  | { t: "whisper"; steamId: string; text: string }
  | { t: "broadcast"; text: string }
  | { t: "map.set"; map: MapId; zone: ControlZoneId; lighting: Lighting | null }
  | { t: "match.end" }
  | { t: "match.restart" }
  | { t: "lighting.set"; value: Lighting }
  | { t: "rotation.add"; entry: Omit<RotationEntry, "status" | "denied"> }
  | { t: "rotation.remove"; index: number }
  | { t: "rotation.move"; index: number; direction: "up" | "down" }
  | { t: "rotation.save" }
  | { t: "reserved.add"; steamId: string }
  | { t: "reserved.remove"; steamId: string }
  | { t: "settings.patch"; patch: Partial<SimSettings> }
  | { t: "reset" };
export interface TimedCommand { id: string; at: number; actor: string; cmd: AdminCommand }
