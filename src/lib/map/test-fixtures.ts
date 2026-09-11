// Builders for engine tests (nodes, requests, members, stamped ops). Test-only; no side effects.
import { mulberry32, seededIds } from "./ids";
import {
  DEFAULT_SQUADS,
  DEFAULT_STROKE_WIDTH,
  asClientId,
  type ClientId,
  type Marker,
  type Measurement,
  type Op,
  type OpBody,
  type RoomSettings,
  type RoomState,
  type RosterMember,
  type Shape,
  type Stroke,
  type SupplyRequest,
  type TextLabel,
} from "./types";
import { createRoomState } from "./reduce";

export const A = asClientId("wd_AAAAAAAAAAAA");
export const B = asClientId("wd_BBBBBBBBBBBB");
export const C = asClientId("wd_CCCCCCCCCCCC");

export const baseSettings = (over: Partial<RoomSettings> = {}): RoomSettings => ({
  team: "Lonestar",
  map: "zestafona",
  controlZone: "default",
  squadMode: false,
  squads: [...DEFAULT_SQUADS],
  drawAccess: "everyone",
  mapSource: { kind: "builtin" },
  ...over,
});

export function makeState(actor: ClientId = A, code = "ABC234", createdAt = 1_000): RoomState {
  return createRoomState({ code, settings: baseSettings(), createdAt, actor });
}

const base = (id: string, over: Record<string, unknown>) => ({
  id,
  layer: "team" as const,
  author: A,
  authorName: "Alpha",
  createdAt: 1_000,
  ...over,
});

export const marker = (id: string, over: Partial<Marker> = {}): Marker =>
  ({
    ...base(id, {}),
    t: "marker",
    kind: "fob",
    at: { x: 0.2, y: 0.8 },
    label: "FOB",
    radius: null,
    team: null,
    ...over,
  }) as Marker;

export const stroke = (id: string, over: Partial<Stroke> = {}): Stroke =>
  ({
    ...base(id, {}),
    t: "stroke",
    color: "blue",
    width: DEFAULT_STROKE_WIDTH,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ],
    ...over,
  }) as Stroke;

export const shape = (id: string, over: Partial<Shape> = {}): Shape =>
  ({
    ...base(id, {}),
    t: "shape",
    shape: "arrow",
    color: "yellow",
    a: { x: 0.3, y: 0.6 },
    b: { x: 0.5, y: 0.5 },
    ...over,
  }) as Shape;

export const text = (id: string, over: Partial<TextLabel> = {}): TextLabel =>
  ({
    ...base(id, {}),
    t: "text",
    at: { x: 0.4, y: 0.3 },
    text: "Hold",
    color: "white",
    size: "md",
    ...over,
  }) as TextLabel;

export const measure = (id: string, over: Partial<Measurement> = {}): Measurement =>
  ({
    ...base(id, {}),
    t: "measure",
    a: { x: 0.1, y: 0.1 },
    b: { x: 0.4, y: 0.1 },
    color: "white",
    ...over,
  }) as Measurement;

export const request = (id: string, over: Partial<SupplyRequest> = {}): SupplyRequest => ({
  id,
  kind: "fuel",
  status: "open",
  priority: "normal",
  by: A,
  byName: "Alpha",
  claimedBy: null,
  claimedByName: null,
  createdAt: 1_000,
  claimedAt: null,
  deliveredAt: null,
  etaSec: null,
  at: { x: 0.4, y: 0.5 },
  note: "",
  layer: "team",
  ...over,
});

export const member = (id: ClientId, over: Partial<RosterMember> = {}): RosterMember => ({
  id,
  callsign: "Alpha",
  role: "member",
  focus: null,
  online: true,
  ink: "blue",
  canDraw: true,
  drawRequested: false,
  joinedAt: 1_000,
  lastSeen: 1_000,
  ...over,
});

let opCounter = 0;
/** Stamp a body with meta: `ts` follows `seq` so histories are easy to read. */
export function op(body: OpBody, seq: number, actor: ClientId = A, id?: string): Op {
  opCounter++;
  return { id: id ?? `OP${String(opCounter).padStart(14, "2")}`, ts: seq * 1_000, actor, seq, ...body };
}

/** Deterministic id factory for tests. */
export const ids = (seed = 1) => seededIds(seed);

/** Fisher–Yates with a seeded RNG. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
