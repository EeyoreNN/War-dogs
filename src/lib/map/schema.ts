// zod v4 schemas for every persisted / wire shape (§3.4). Relay-reachable: relative imports only.
import { z } from "zod";
import { site } from "../../config/site";
import { CONTROL_ZONE_IDS, MAP_IDS } from "../terrain/types";
import { AnyRoomCodeSchema } from "../room/schema";
import { CLIENT_ID_PATTERN, ID_PATTERN } from "./ids";
import {
  FOCUSES,
  INK_COLORS,
  MARKER_KINDS,
  MAX_LABEL_CHARS,
  MAX_NODES,
  MAX_NODES_PER_OP,
  MAX_NOTE_CHARS,
  MAX_SQUADS,
  MAX_STROKE_POINTS,
  MAX_TEXT_CHARS,
  MAX_TEXT_LINES,
  REQUEST_KINDS,
  SQUAD_NAME_LENGTH,
  TOOLS,
  type ClientId,
  type LayerId,
  type RoomSnapshot,
  type RoomState,
} from "./types";

// ---------------------------------------------------------------------------------------------
// Scalars

// C0 controls and DEL; the text schema additionally allows "\n" (built without a literal
// control character so the source stays greppable).
const CONTROL_CHARS = new RegExp("[\\x00-\\x1f\\x7f]");
const CONTROL_CHARS_BUT_NEWLINE = new RegExp("[\\x00-\\x09\\x0b-\\x1f\\x7f]");
const noControl = (s: string) => !CONTROL_CHARS.test(s);

const int = z.number().int();
const timestamp = int.nonnegative();

/** Trimmed, 2–24 chars, no control characters. */
export const CallsignSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .refine(noControl, "control characters");

export const ClientIdSchema = z
  .string()
  .regex(CLIENT_ID_PATTERN)
  .transform((s) => s as ClientId);

/** Node / request / op ids: base32, no ":" (keys.ts relies on it). */
export const IdSchema = z.string().regex(ID_PATTERN);

/** Finite numbers in [0, 1] (zod 4 rejects NaN and ±Infinity by default). */
export const PointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

const squadName = z
  .string()
  .min(SQUAD_NAME_LENGTH[0])
  .max(SQUAD_NAME_LENGTH[1])
  .refine(noControl, "control characters");

export const LayerIdSchema = z
  .string()
  .max(6 + SQUAD_NAME_LENGTH[1])
  .refine(
    (s) => s === "team" || (s.startsWith("squad:") && squadName.safeParse(s.slice(6)).success),
    "layer",
  )
  .transform((s) => s as LayerId);

export const TeamSchema = z.enum(site.game.teams);
export const MapIdSchema = z.enum(MAP_IDS);
export const ControlZoneIdSchema = z.enum(CONTROL_ZONE_IDS);
export const InkColorSchema = z.enum(INK_COLORS);
export const MarkerKindSchema = z.enum(MARKER_KINDS);
export const FocusSchema = z.enum(FOCUSES);
export const RoleSchema = z.enum(["commander", "co-commander", "member"]);
export const ToolSchema = z.enum(TOOLS);
export const RequestKindSchema = z.enum(REQUEST_KINDS);
export const RequestStatusSchema = z.enum(["open", "claimed", "delivered"]);
export const RequestPrioritySchema = z.enum(["normal", "urgent"]);
export const TextSizeSchema = z.enum(["sm", "md", "lg"]);
export const NodeTypeSchema = z.enum(["stroke", "shape", "marker", "text", "measure"]);

const labelText = z.string().max(MAX_LABEL_CHARS).refine(noControl, "control characters");
const bodyText = z
  .string()
  .max(MAX_TEXT_CHARS)
  .refine((s) => (s.match(/\n/g)?.length ?? 0) <= MAX_TEXT_LINES - 1, "too many lines")
  .refine((s) => !CONTROL_CHARS_BUT_NEWLINE.test(s), "control characters");
const noteText = z.string().max(MAX_NOTE_CHARS).refine(noControl, "control characters");
const radius = z.number().gt(0).max(1).nullable();

// ---------------------------------------------------------------------------------------------
// Nodes

const nodeBase = {
  id: IdSchema,
  layer: LayerIdSchema,
  author: ClientIdSchema,
  authorName: CallsignSchema,
  createdAt: timestamp,
};
const points = z.array(PointSchema).min(2).max(MAX_STROKE_POINTS);

export const StrokeSchema = z.object({
  ...nodeBase,
  t: z.literal("stroke"),
  color: InkColorSchema,
  width: z.number().gt(0).max(0.05),
  points,
});
export const ShapeSchema = z.object({
  ...nodeBase,
  t: z.literal("shape"),
  shape: z.enum(["arrow", "line", "circle", "rect"]),
  color: InkColorSchema,
  a: PointSchema,
  b: PointSchema,
});
export const MarkerSchema = z.object({
  ...nodeBase,
  t: z.literal("marker"),
  kind: MarkerKindSchema,
  at: PointSchema,
  label: labelText,
  radius,
  team: TeamSchema.nullable(),
});
export const TextLabelSchema = z.object({
  ...nodeBase,
  t: z.literal("text"),
  at: PointSchema,
  text: bodyText,
  color: InkColorSchema,
  size: TextSizeSchema,
});
export const MeasurementSchema = z.object({
  ...nodeBase,
  t: z.literal("measure"),
  a: PointSchema,
  b: PointSchema,
  color: InkColorSchema,
});
export const MapNodeSchema = z.discriminatedUnion("t", [
  StrokeSchema,
  ShapeSchema,
  MarkerSchema,
  TextLabelSchema,
  MeasurementSchema,
]);

/** Every patchable key with the entity caps; the reducer drops keys that do not fit the node type. */
export const NodePatchSchema = z
  .object({
    at: PointSchema,
    a: PointSchema,
    b: PointSchema,
    label: labelText,
    text: bodyText,
    color: InkColorSchema,
    radius,
    size: TextSizeSchema,
    layer: LayerIdSchema,
    points,
    team: TeamSchema.nullable(),
  })
  .partial();

// ---------------------------------------------------------------------------------------------
// Requests, roster, settings

const etaSec = int.min(0).max(86_400).nullable();

export const SupplyRequestSchema = z.object({
  id: IdSchema,
  kind: RequestKindSchema,
  status: RequestStatusSchema,
  priority: RequestPrioritySchema,
  by: ClientIdSchema,
  byName: CallsignSchema,
  claimedBy: ClientIdSchema.nullable(),
  claimedByName: CallsignSchema.nullable(),
  createdAt: timestamp,
  claimedAt: timestamp.nullable(),
  deliveredAt: timestamp.nullable(),
  etaSec,
  at: PointSchema.nullable(),
  note: noteText,
  layer: LayerIdSchema,
});
export const RequestPatchSchema = z
  .object({
    status: RequestStatusSchema,
    priority: RequestPrioritySchema,
    claimedBy: ClientIdSchema.nullable(),
    claimedByName: CallsignSchema.nullable(),
    claimedAt: timestamp.nullable(),
    deliveredAt: timestamp.nullable(),
    etaSec,
    at: PointSchema.nullable(),
    note: noteText,
    kind: RequestKindSchema,
  })
  .partial();

export const RosterMemberSchema = z.object({
  id: ClientIdSchema,
  callsign: CallsignSchema,
  role: RoleSchema,
  focus: FocusSchema.nullable(),
  squad: squadName.optional(),
  online: z.boolean(),
  ink: InkColorSchema,
  canDraw: z.boolean(),
  drawRequested: z.boolean(),
  joinedAt: timestamp,
  lastSeen: timestamp,
});
export const RosterPatchSchema = RosterMemberSchema.omit({ id: true }).partial();

export const MapSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("builtin") }),
  z.object({
    kind: z.literal("upload"),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    w: int.min(1).max(1024),
    h: int.min(1).max(1024),
    mime: z.string().max(64),
    name: z.string().max(64),
  }),
]);

export const RoomSettingsSchema = z.object({
  team: TeamSchema,
  map: MapIdSchema,
  controlZone: ControlZoneIdSchema,
  squadMode: z.boolean(),
  squads: z
    .array(squadName)
    .max(MAX_SQUADS)
    .refine((xs) => new Set(xs).size === xs.length, "squads must be unique"),
  drawAccess: z.enum(["everyone", "request"]),
  mapSource: MapSourceSchema,
});
export const RoomSettingsPatchSchema = RoomSettingsSchema.partial();

// ---------------------------------------------------------------------------------------------
// State, ops, snapshots

export const RevSchema = z.object({ seq: int.nonnegative(), actor: ClientIdSchema });

const revRecord = z.record(z.string().max(160), RevSchema);

export const RoomStateSchema = z.object({
  v: z.literal(1),
  code: AnyRoomCodeSchema,
  createdAt: timestamp,
  settings: RoomSettingsSchema,
  nodes: z
    .record(IdSchema, MapNodeSchema)
    .refine((m) => Object.keys(m).length <= MAX_NODES, "too many nodes"),
  order: z.array(IdSchema).max(MAX_NODES),
  requests: z.record(IdSchema, SupplyRequestSchema),
  roster: z.record(z.string().regex(CLIENT_ID_PATTERN), RosterMemberSchema),
  revs: revRecord,
  tombstones: revRecord,
  seq: int.nonnegative(),
});

const opMeta = { id: IdSchema, ts: timestamp, actor: ClientIdSchema, seq: int.nonnegative() };

export const OpSchema = z.discriminatedUnion("t", [
  z.object({
    ...opMeta,
    t: z.literal("node.add"),
    nodes: z.array(MapNodeSchema).min(1).max(MAX_NODES_PER_OP),
  }),
  z.object({ ...opMeta, t: z.literal("node.update"), id: IdSchema, patch: NodePatchSchema }),
  z.object({
    ...opMeta,
    t: z.literal("node.remove"),
    ids: z.array(IdSchema).min(1).max(MAX_NODES_PER_OP),
  }),
  z.object({
    ...opMeta,
    t: z.literal("layer.clear"),
    layer: LayerIdSchema,
    types: z.array(NodeTypeSchema).max(5).nullable(),
  }),
  z.object({ ...opMeta, t: z.literal("request.add"), request: SupplyRequestSchema }),
  z.object({ ...opMeta, t: z.literal("request.update"), id: IdSchema, patch: RequestPatchSchema }),
  z.object({ ...opMeta, t: z.literal("request.remove"), id: IdSchema }),
  z.object({ ...opMeta, t: z.literal("roster.upsert"), member: RosterMemberSchema }),
  z.object({
    ...opMeta,
    t: z.literal("roster.update"),
    id: ClientIdSchema,
    patch: RosterPatchSchema,
  }),
  z.object({ ...opMeta, t: z.literal("roster.remove"), id: ClientIdSchema }),
  z.object({ ...opMeta, t: z.literal("settings.update"), patch: RoomSettingsPatchSchema }),
]);

export const RoomSnapshotSchema = z.object({
  v: z.literal(1),
  state: RoomStateSchema,
  savedAt: timestamp,
});

export const IdentitySchema = z.object({
  client: ClientIdSchema,
  callsign: CallsignSchema,
  focus: FocusSchema.nullable(),
  ink: InkColorSchema,
});
export const PresenceSchema = z.object({
  client: ClientIdSchema,
  callsign: z.string().max(24),
  seenAt: z.number(),
  cursor: PointSchema.nullable(),
});
export const PingSchema = z.object({
  id: IdSchema,
  at: PointSchema,
  by: ClientIdSchema,
  byName: z.string().max(24),
  color: InkColorSchema,
  ts: timestamp,
  commander: z.boolean(),
});

let warned = false;
function warnOnce(issue: unknown): void {
  if (warned || process.env.NODE_ENV === "production") return;
  warned = true;
  console.warn("[wardogs] snapshot rejected", issue);
}

/** Never throws; logs once in dev. */
export function parseSnapshot(json: unknown): RoomSnapshot | null {
  try {
    const r = RoomSnapshotSchema.safeParse(json);
    if (r.success) return r.data as RoomSnapshot;
    warnOnce(r.error.issues.slice(0, 3));
    return null;
  } catch (e) {
    warnOnce(e);
    return null;
  }
}

/** v1 only: anything else (older, newer, junk) is null. */
export function migrateSnapshot(raw: unknown): RoomSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as { v?: unknown }).v;
  if (v !== 1) return null;
  return parseSnapshot(raw);
}

/** Type-level guard: the inferred output of RoomStateSchema is assignable to RoomState. */
export type ParsedRoomState = z.infer<typeof RoomStateSchema>;
const assertState: RoomState = null as unknown as ParsedRoomState;
void assertState;
