// Wire frame validation and the one table of frame limits both sides use (§3.5).
// Relay-reachable: relative imports only (§3.0).
import { z } from "zod";
import {
  ClientIdSchema,
  IdentitySchema,
  OpSchema,
  PingSchema,
  PointSchema,
  PresenceSchema,
  RoomStateSchema,
} from "../map/schema";
import type { WireMessage } from "./transport";

export const WIRE_LIMITS = {
  default: 65_536, // op, sync.request, presence, bye, ping, cursor, map.request, error
  "map.chunk": 262_144,
  hello: 2_097_152, // carries a snapshot
  "sync.snapshot": 2_097_152,
  "sync.ops": 2_097_152, // up to 500 ops
  max: 2_097_152,
} as const;

export const MAX_SYNC_OPS = 500;
export const MAX_PRESENCE_MEMBERS = 128;
/** 48 kB of bytes per chunk (§5.7) is 65,536 base64 characters. */
export const MAP_CHUNK_BYTES = 49_152;
export const MAX_MAP_CHUNK_DATA = 65_536 + 64;

export function wireLimit(kind: WireMessage["k"]): number {
  return (WIRE_LIMITS as Record<string, number>)[kind] ?? WIRE_LIMITS.default;
}

const room = z.string().min(1).max(32);
const hash = z.string().regex(/^[0-9a-f]{64}$/);

export const WireMessageSchema = z.discriminatedUnion("k", [
  z.object({
    k: z.literal("hello"),
    room,
    identity: IdentitySchema,
    seq: z.number().int().nonnegative(),
    snapshot: RoomStateSchema.nullable(),
  }),
  z.object({ k: z.literal("op"), room, op: OpSchema }),
  z.object({ k: z.literal("sync.request"), room, since: z.number().int().nonnegative() }),
  z.object({ k: z.literal("sync.snapshot"), room, state: RoomStateSchema }),
  z.object({ k: z.literal("sync.ops"), room, ops: z.array(OpSchema).max(MAX_SYNC_OPS) }),
  z.object({
    k: z.literal("presence"),
    room,
    members: z.array(PresenceSchema).max(MAX_PRESENCE_MEMBERS),
  }),
  z.object({ k: z.literal("bye"), room, client: ClientIdSchema }),
  z.object({ k: z.literal("ping"), room, ping: PingSchema }),
  z.object({ k: z.literal("cursor"), room, client: ClientIdSchema, at: PointSchema.nullable() }),
  z.object({ k: z.literal("map.request"), room, hash }),
  z.object({
    k: z.literal("map.chunk"),
    room,
    hash,
    i: z.number().int().nonnegative(),
    n: z.number().int().min(1).max(64),
    mime: z.string().max(64),
    w: z.number().int().min(1).max(1024),
    h: z.number().int().min(1).max(1024),
    data: z.string().max(MAX_MAP_CHUNK_DATA),
  }),
  z.object({
    k: z.literal("error"),
    room,
    code: z.enum(["room-full", "rate-limit", "bad-frame", "kicked"]),
    message: z.string().max(200),
  }),
]);

/**
 * null when the frame exceeds WIRE_LIMITS.max, is not JSON, fails the schema, or exceeds the
 * per-kind limit. The relay passes the raw byte length; the client passes `raw.length`.
 */
export function parseWire(raw: string, byteLength: number = raw.length): WireMessage | null {
  if (byteLength > WIRE_LIMITS.max) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = WireMessageSchema.safeParse(json);
  if (!r.success) return null;
  if (byteLength > wireLimit(r.data.k)) return null;
  return r.data as WireMessage;
}

/** Validate an already-structured message (BroadcastChannel / memory bus). */
export function validateWire(msg: unknown): WireMessage | null {
  const r = WireMessageSchema.safeParse(msg);
  return r.success ? (r.data as WireMessage) : null;
}
