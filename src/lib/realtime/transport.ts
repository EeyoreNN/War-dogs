import type { ClientId, Identity, Op, Ping, Point, Presence, RoomState, SyncStatus } from "../map/types";

export type TransportKind = "broadcast" | "ws" | "memory";

/** Wire messages. Every frame is JSON of exactly one of these. `room` is the room code. */
export type WireMessage =
  | { k: "hello"; room: string; identity: Identity; seq: number; snapshot: RoomState | null }
  | { k: "op"; room: string; op: Op }
  | { k: "sync.request"; room: string; since: number }
  | { k: "sync.snapshot"; room: string; state: RoomState }
  | { k: "sync.ops"; room: string; ops: Op[] }
  | { k: "presence"; room: string; members: Presence[] }
  | { k: "bye"; room: string; client: ClientId }
  | { k: "ping"; room: string; ping: Ping }
  | { k: "cursor"; room: string; client: ClientId; at: Point | null }
  | { k: "map.request"; room: string; hash: string }
  | { k: "map.chunk"; room: string; hash: string; i: number; n: number; mime: string; w: number; h: number; data: string }
  | { k: "error"; room: string; code: "room-full" | "rate-limit" | "bad-frame" | "kicked"; message: string };

export type EphemeralMessage = Extract<WireMessage, { k: "ping" | "cursor" | "map.request" | "map.chunk" }>;
export type Unsubscribe = () => void;

export interface Transport {
  readonly kind: TransportKind;
  readonly status: SyncStatus;
  /** Connect and announce. `snapshot` is the caller's persisted state (may be null). Resolves when hello was sent (not when synced). */
  join(roomCode: string, identity: Identity, seq: number, snapshot: RoomState | null): Promise<void>;
  /** Broadcast an op to the room. Queued while reconnecting (cap 1000, oldest dropped). */
  send(op: Op): void;
  sendEphemeral(msg: EphemeralMessage): void;
  requestSnapshot(since: number): void;
  onOp(cb: (op: Op) => void): Unsubscribe;
  onSnapshot(cb: (state: RoomState) => void): Unsubscribe;
  onOps(cb: (ops: Op[]) => void): Unsubscribe;
  onPresence(cb: (members: Presence[]) => void): Unsubscribe;
  onEphemeral(cb: (msg: EphemeralMessage) => void): Unsubscribe;
  onStatus(cb: (status: SyncStatus) => void): Unsubscribe;
  onError(cb: (err: Extract<WireMessage, { k: "error" }>) => void): Unsubscribe;
  leave(): void;
}

export interface TransportOptions {
  /** Called by the broadcast transport to answer a peer's sync.request; ws leaves this to the relay. */
  getState: () => RoomState | null;
  /** Resolved by resolveRelayUrl() (§5.2); undefined → broadcast. */
  relayUrl?: string;
  /** Default 3000; on timeout fall back to broadcast (status "local"). */
  connectTimeoutMs?: number;
}
export interface MemoryBus {
  publish(from: object, msg: WireMessage): void;
  subscribe(self: object, cb: (msg: WireMessage) => void): Unsubscribe;
}
