// Relay-reachable: relative imports only (§3.0).
import { z } from "zod";
import { CODE_PATTERN, RESERVED_CODES, normalizeCode } from "./code";

/** Normalises ("x5gm-4q" → "X5GM4Q") and then requires a six-symbol code. */
export const RoomCodeSchema = z.string().transform(normalizeCode).pipe(z.string().regex(CODE_PATTERN));

/** A room code or a reserved code (`DEMO`): `RoomState.code` and the `/room/[code]` route. */
export const AnyRoomCodeSchema = RoomCodeSchema.or(z.enum(RESERVED_CODES));

/** The relay room pattern for the demo: `DEMO-<epochIndex>` (§5.6). */
export const DEMO_RELAY_ROOM_PATTERN = /^DEMO-\d{1,9}$/;
/** A room name accepted by the relay upgrade: a room code or a demo epoch room (§3.6). */
export const RelayRoomSchema = RoomCodeSchema.or(z.string().regex(DEMO_RELAY_ROOM_PATTERN));
