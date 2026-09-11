import type { Team } from "../../config/site";
import type { Point } from "../geo";
import type { ControlZoneId, MapId } from "../terrain/types";

export type { Point, Team, MapId, ControlZoneId };

/**
 * Opaque per-browser client id: "wd_" + 12 base32 chars, minted once per browser and kept in
 * localStorage (`wardogs:identity`, §5.4). Every tab of one browser shares it: one person is one
 * roster member, and a second tab is the same member. Ordering by string compare is part of the
 * LWW tie-break (Rev).
 */
export type ClientId = string & { readonly __brand: "ClientId" };
export const asClientId = (s: string): ClientId => s as ClientId;

/** Base pixel size of map space. screenX = worldX * MAP_PX * scale + tx (same for y). */
export const MAP_PX = 2048;
export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export const TOOLS = [
  "select", "pen", "arrow", "line", "circle", "rect", "text", "measure", "marker", "request", "ping",
] as const;
export type Tool = (typeof TOOLS)[number];

export const INK_COLORS = ["blue", "red", "green", "yellow", "white", "black"] as const;
export type InkColor = (typeof INK_COLORS)[number];
export const INK_HEX: Record<InkColor, string> = {
  blue: "#5fb8ff",
  red: "#ff4d4d",
  green: "#46c46e",
  yellow: "#e8d26a",
  white: "#f1ebdd",
  black: "#141311",
};
export const INK_LABEL: Record<InkColor, string> = {
  blue: "Blue", red: "Red", green: "Green", yellow: "Yellow", white: "White", black: "Black",
};

export type MarkerGroup = "friendly" | "enemy" | "mark";
export const MARKER_KINDS = [
  "fob", "rally", "lz", "obj", "enemy-fob", "enemy-troops", "danger", "pin",
] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];
export const MARKER_META: Record<
  MarkerKind,
  { group: MarkerGroup; label: string; short: string; hotkey: string }
> = {
  fob: { group: "friendly", label: "Forward operating base", short: "FOB", hotkey: "1" },
  rally: { group: "friendly", label: "Rally point", short: "RALLY", hotkey: "2" },
  lz: { group: "friendly", label: "Landing zone", short: "LZ", hotkey: "3" },
  obj: { group: "friendly", label: "Objective", short: "OBJ", hotkey: "4" },
  "enemy-fob": { group: "enemy", label: "Enemy FOB", short: "FOB", hotkey: "5" },
  "enemy-troops": { group: "enemy", label: "Enemy troops", short: "TROOPS", hotkey: "6" },
  danger: { group: "mark", label: "Danger area", short: "DANGER", hotkey: "7" },
  pin: { group: "mark", label: "Pin", short: "PIN", hotkey: "8" },
};

/** "team" is the shared team layer; squads get their own. */
export type LayerId = "team" | `squad:${string}`;

export const FOCUSES = ["infantry", "medic", "recon", "support", "driver", "pilot"] as const;
export type Focus = (typeof FOCUSES)[number];
export const FOCUS_LABEL: Record<Focus, string> = {
  infantry: "Infantry", medic: "Medic", recon: "Recon", support: "Support", driver: "Driver", pilot: "Pilot",
};

export type Role = "commander" | "co-commander" | "member";

interface NodeBase {
  id: string;
  layer: LayerId;
  author: ClientId;
  authorName: string;
  createdAt: number;
}
export interface Stroke extends NodeBase {
  t: "stroke";
  color: InkColor;
  /** Fraction of map width. Default 0.003. */
  width: number;
  /** 2..MAX_STROKE_POINTS points (simplified on commit). */
  points: Point[];
}
export type ShapeKind = "arrow" | "line" | "circle" | "rect";
/** line/arrow: a→b. circle: a = centre, b = a point on the radius. rect: opposite corners. */
export interface Shape extends NodeBase {
  t: "shape";
  shape: ShapeKind;
  color: InkColor;
  a: Point;
  b: Point;
}
export interface Marker extends NodeBase {
  t: "marker";
  kind: MarkerKind;
  at: Point;
  /** User label ≤ MAX_LABEL_CHARS, may be "". Default label is MARKER_META[kind].short. */
  label: string;
  /** Danger area radius as a fraction of map width; null for every other kind. */
  radius: number | null;
  /** Enemy faction for the "enemy" group (one of the two non-friendly teams); null for every other kind. */
  team: Team | null;
}
export interface TextLabel extends NodeBase {
  t: "text";
  at: Point;
  /** ≤ MAX_TEXT_CHARS chars, ≤ MAX_TEXT_LINES lines. */
  text: string;
  color: InkColor;
  size: "sm" | "md" | "lg";
}
export interface Measurement extends NodeBase {
  t: "measure";
  a: Point;
  b: Point;
  color: InkColor;
}
export type MapNode = Stroke | Shape | Marker | TextLabel | Measurement;
export type NodeType = MapNode["t"];

/** Keys that do not apply to a node's type are ignored by the reducer. */
export type NodePatch = Partial<{
  at: Point;
  a: Point;
  b: Point;
  label: string;
  text: string;
  color: InkColor;
  radius: number | null;
  size: TextLabel["size"];
  layer: LayerId;
  points: Point[];
  team: Team | null;
}>;

export const REQUEST_KINDS = ["fuel", "medical", "ammo", "other"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  fuel: "Fuel", medical: "Medical", ammo: "Ammo", other: "Other",
};
export type RequestStatus = "open" | "claimed" | "delivered";
export type RequestPriority = "normal" | "urgent";
export interface SupplyRequest {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  priority: RequestPriority;
  by: ClientId;
  byName: string;
  claimedBy: ClientId | null;
  claimedByName: string | null;
  createdAt: number;
  claimedAt: number | null;
  deliveredAt: number | null;
  /** Seconds promised by the claimer at claimedAt; null = none given. */
  etaSec: number | null;
  /** Map location; null = no location. */
  at: Point | null;
  /** ≤ MAX_NOTE_CHARS. */
  note: string;
  layer: LayerId;
}
export type RequestPatch = Partial<
  Pick<SupplyRequest, "status" | "priority" | "claimedBy" | "claimedByName" | "claimedAt" | "deliveredAt" | "etaSec" | "at" | "note" | "kind">
>;

export interface RosterMember {
  id: ClientId;
  callsign: string;
  role: Role;
  focus: Focus | null;
  squad?: string;
  /**
   * Persisted flag, not the truth: set true by the member itself on boot, set false by the
   * single-writer after ONLINE_TTL_MS without presence (§5.5). The UI and every roster rule read
   * `isOnline(member, presence, now)` (§3.4), never this field directly.
   */
  online: boolean;
  ink: InkColor;
  /** Only consulted when settings.drawAccess === "request". Commanders always draw. */
  canDraw: boolean;
  drawRequested: boolean;
  joinedAt: number;
  lastSeen: number;
}
export type RosterPatch = Partial<Omit<RosterMember, "id">>;

export type DrawAccess = "everyone" | "request";
export type MapSource =
  | { kind: "builtin" }
  | {
      kind: "upload";
      /** SHA-256 hex of the *shared* JPEG bytes (the 1024 px variant, §5.7). Receivers verify against it. */
      hash: string;
      /** Dimensions of the shared variant: square after letterboxing, w === h ≤ 1024. */
      w: number;
      h: number;
      /** Always "image/jpeg" in v1 (the shared variant's type). */
      mime: string;
      /** Original file name, trimmed to ≤ 64 chars. */
      name: string;
    };
export interface RoomSettings {
  team: Team;
  map: MapId;
  controlZone: ControlZoneId;
  squadMode: boolean;
  /** Squad names when squadMode; default DEFAULT_SQUADS. Each 2–16 chars, unique, ≤ MAX_SQUADS. No rename in v1: remove + add. */
  squads: string[];
  drawAccess: DrawAccess;
  mapSource: MapSource;
}

/** Last-writer-wins revision. Ordering: seq, then actor (string compare). Equal = the same op. */
export interface Rev {
  seq: number;
  actor: ClientId;
}

export interface RoomState {
  v: 1;
  code: string;
  createdAt: number;
  settings: RoomSettings;
  nodes: Record<string, MapNode>;
  /**
   * Derived canonical z-order: every node id sorted by (createdAt asc, id asc). The reducer
   * recomputes it whenever `nodes` changes (`canonicalOrder`); nothing else writes it.
   */
  order: string[];
  requests: Record<string, SupplyRequest>;
  roster: Record<string, RosterMember>;
  /**
   * Rev per key (src/lib/map/keys.ts). Entity keys — node id | request id | `roster:${clientId}` —
   * hold the rev of the op that created or last replaced the entity. Field keys —
   * `${entityKey}:${field}` — hold the rev of the last applied patch to that field.
   * `settings:${field}` holds the rev of each settings field.
   */
  revs: Record<string, Rev>;
  /** Removed entity keys (nodes, requests, roster) with the rev that removed them. Compacted to MAX_TOMBSTONES on save. */
  tombstones: Record<string, Rev>;
  /** Highest seq seen (Lamport clock). */
  seq: number;
}

export interface OpMeta {
  id: string;
  ts: number;
  actor: ClientId;
  seq: number;
}
export type OpBody =
  | { t: "node.add"; nodes: MapNode[] }                       // 1..MAX_NODES_PER_OP nodes
  | { t: "node.update"; id: string; patch: NodePatch }
  | { t: "node.remove"; ids: string[] }                       // 1..MAX_NODES_PER_OP ids
  | { t: "layer.clear"; layer: LayerId; types: NodeType[] | null }
  | { t: "request.add"; request: SupplyRequest }
  | { t: "request.update"; id: string; patch: RequestPatch }
  | { t: "request.remove"; id: string }
  | { t: "roster.upsert"; member: RosterMember }
  | { t: "roster.update"; id: ClientId; patch: RosterPatch }
  | { t: "roster.remove"; id: ClientId }
  | { t: "settings.update"; patch: Partial<RoomSettings> };
export type Op = OpMeta & OpBody;
export type OpType = OpBody["t"];

/** Transient. Never persisted, never an op. */
export interface Ping {
  id: string;
  at: Point;
  by: ClientId;
  byName: string;
  color: InkColor;
  ts: number;
  commander: boolean;
}
export interface Presence {
  client: ClientId;
  callsign: string;
  /** Local receipt time on the receiver's clock (§5.5); the value on the wire is ignored. */
  seenAt: number;
  cursor: Point | null;
}

export interface Identity {
  client: ClientId;
  callsign: string;
  focus: Focus | null;
  ink: InkColor;
}

export type SyncStatus = "local" | "connecting" | "live" | "reconnecting" | "offline";

/** The only persistence / export / seed format. */
export interface RoomSnapshot {
  v: 1;
  state: RoomState;
  savedAt: number;
}
export interface RecentRoom {
  code: string;
  team: Team;
  map: MapId;
  controlZone: ControlZoneId;
  role: Role;
  updatedAt: number;
}

export const DEFAULT_STROKE_WIDTH = 0.003;
export const DEFAULT_DANGER_RADIUS = 0.04;
export const DEFAULT_SQUADS = ["Alpha", "Bravo", "Charlie"];
export const DEMO_ROOM_CODE = "DEMO";
export const MAX_NODES = 4000;
export const MAX_NODES_PER_OP = 200;
export const MAX_TOMBSTONES = 2000;
export const MAX_STATE_BYTES = 600_000;
export const MAX_STROKE_POINTS = 2000;
export const MAX_TEXT_CHARS = 80;
export const MAX_TEXT_LINES = 3;
export const MAX_LABEL_CHARS = 32;
export const MAX_NOTE_CHARS = 60;
export const MAX_SQUADS = 8;
export const SQUAD_NAME_LENGTH: readonly [number, number] = [2, 16];
export const ONLINE_TTL_MS = 60_000;
export const IDLE_AFTER_MS = 90_000;
export const PEER_TTL_MS = 30_000;
