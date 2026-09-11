// The demo / hero scenario (§3.4, §4.2). Everything is deterministic per epoch index so two
// visitors' local copies of a bot op are byte-identical and dedupe by rev.
import { applyOps, canonicalOrder, createRoomState } from "./reduce";
import { seededIds } from "./ids";
import {
  DEFAULT_SQUADS,
  DEFAULT_STROKE_WIDTH,
  DEMO_ROOM_CODE,
  asClientId,
  type ClientId,
  type MapNode,
  type Op,
  type OpBody,
  type Ping,
  type Presence,
  type RoomSettings,
  type RoomState,
  type RosterMember,
  type SupplyRequest,
} from "./types";

export interface ScenarioEvent {
  at: number;
  kind: "op";
  body: OpBody;
  actor: ClientId;
  actorName: string;
}
export interface ScenarioPing {
  at: number;
  kind: "ping";
  ping: Omit<Ping, "id" | "ts">;
}
export type ScenarioItem = ScenarioEvent | ScenarioPing;

export const DEMO_EPOCH_MS = 300_000;

export const DEMO_BOT_IDS: Record<"ossian" | "krieger" | "boston" | "rook", ClientId> = {
  ossian: asClientId("wd_ZBQTAAAAAAA2"),
  krieger: asClientId("wd_ZBQTBBBBBBB2"),
  boston: asClientId("wd_ZBQTCCCCCCC2"),
  rook: asClientId("wd_ZBQTDDDDDDD2"),
};
const BOT_NAME: Record<ClientId, string> = {
  [DEMO_BOT_IDS.ossian]: "Ossian",
  [DEMO_BOT_IDS.krieger]: "Krieger",
  [DEMO_BOT_IDS.boston]: "Boston",
  [DEMO_BOT_IDS.rook]: "Rook",
};
export const isDemoBot = (id: string): boolean => id in BOT_NAME;

const bot = (id: ClientId, over: Partial<RosterMember>): RosterMember => ({
  id,
  callsign: BOT_NAME[id],
  role: "member",
  focus: null,
  online: true,
  ink: "blue",
  canDraw: true,
  drawRequested: false,
  joinedAt: 0,
  lastSeen: 0,
  ...over,
});

export const DEMO_BOTS: readonly RosterMember[] = [
  bot(DEMO_BOT_IDS.ossian, { role: "commander", focus: "infantry", ink: "yellow" }),
  bot(DEMO_BOT_IDS.krieger, { focus: "pilot", ink: "green" }),
  bot(DEMO_BOT_IDS.boston, { focus: "medic", ink: "blue" }),
  bot(DEMO_BOT_IDS.rook, { focus: "recon", ink: "red" }),
];

export const DEMO_SETTINGS: RoomSettings = {
  team: "Lonestar",
  map: "zestafona",
  controlZone: "default",
  squadMode: false,
  squads: [...DEFAULT_SQUADS],
  drawAccess: "everyone",
  mapSource: { kind: "builtin" },
};

export const ZONE_CENTRE = { x: 0.5, y: 0.47 };

export function epochStart(now: number): number {
  return now - (now % DEMO_EPOCH_MS);
}
export function epochIndex(now: number): number {
  return Math.floor(now / DEMO_EPOCH_MS);
}
/** The relay room (`DEMO-<n>`); `RoomState.code` stays "DEMO". */
export function demoRelayRoom(now: number): string {
  return `DEMO-${epochIndex(now)}`;
}

// ---------------------------------------------------------------------------------------------
// Seed plan — fixed entity ids so the timeline can refer to them; op ids come from seededIds.

export const SEED_IDS = {
  fob: "DEMQFQBDELTA2222",
  rally: "DEMQRALLY2222222",
  lz: "DEMQLZBRAVQ22222",
  obj: "DEMQQBJDEFAULT22",
  enemyFob: "DEMQENEMYFQB2222",
  enemyTroops: "DEMQENEMYTRQQPS2",
  danger: "DEMQMGNEST222222",
  arrow: "DEMQARRQW2222222",
  strokeA: "DEMQSTRQKEA22222",
  strokeB: "DEMQSTRQKEB22222",
  text: "DEMQTEXTRIDGE222",
  reqFuel: "DEMQREQFUEL22222",
  reqMedical: "DEMQREQMEDICAL22",
  reqAmmo: "DEMQREQAMMQ22222",
} as const;

export const TIMELINE_IDS = {
  troops: "DEMQBQTTRQQPS222",
  arrow: "DEMQBQTARRQW2222",
  medical: "DEMQBQTMEDICAL22",
  text: "DEMQBQTTEXT22222",
  danger: "DEMQBQTDANGER222",
  ammo: "DEMQBQTAMMQ22222",
  heroLz: "DEMQHERQLZ222222",
} as const;

const { ossian, krieger, boston, rook } = DEMO_BOT_IDS;

const nodeBase = (id: string, author: ClientId, createdAt: number) => ({
  id,
  layer: "team" as const,
  author,
  authorName: BOT_NAME[author],
  createdAt,
});

/** The seed nodes with `createdAt` relative to the epoch start (0 = epoch start). */
function seedNodes(): MapNode[] {
  return [
    {
      ...nodeBase(SEED_IDS.fob, ossian, 1),
      t: "marker",
      kind: "fob",
      at: { x: 0.18, y: 0.8 },
      label: "FOB DELTA",
      radius: null,
      team: null,
    },
    {
      ...nodeBase(SEED_IDS.rally, ossian, 2),
      t: "marker",
      kind: "rally",
      at: { x: 0.34, y: 0.6 },
      label: "RALLY",
      radius: null,
      team: null,
    },
    {
      ...nodeBase(SEED_IDS.lz, ossian, 3),
      t: "marker",
      kind: "lz",
      at: { x: 0.4, y: 0.52 },
      label: "LZ BRAVO",
      radius: null,
      team: null,
    },
    {
      ...nodeBase(SEED_IDS.obj, ossian, 4),
      t: "marker",
      kind: "obj",
      at: ZONE_CENTRE,
      label: "DEFAULT",
      radius: null,
      team: null,
    },
    {
      ...nodeBase(SEED_IDS.enemyFob, rook, 5),
      t: "marker",
      kind: "enemy-fob",
      at: { x: 0.8, y: 0.22 },
      label: "AUSTIN",
      radius: null,
      team: "Valkyra",
    },
    {
      ...nodeBase(SEED_IDS.enemyTroops, rook, 6),
      t: "marker",
      kind: "enemy-troops",
      at: { x: 0.63, y: 0.36 },
      label: "CHICAGO",
      radius: null,
      team: "Manticore",
    },
    {
      ...nodeBase(SEED_IDS.danger, rook, 7),
      t: "marker",
      kind: "danger",
      at: { x: 0.58, y: 0.41 },
      label: "MG NEST",
      radius: 0.05,
      team: null,
    },
    {
      ...nodeBase(SEED_IDS.arrow, ossian, 8),
      t: "shape",
      shape: "arrow",
      color: "yellow",
      a: { x: 0.3, y: 0.66 },
      b: { x: 0.47, y: 0.5 },
    },
    {
      ...nodeBase(SEED_IDS.strokeA, ossian, 9),
      t: "stroke",
      color: "blue",
      width: DEFAULT_STROKE_WIDTH,
      points: [
        { x: 0.2, y: 0.78 },
        { x: 0.23, y: 0.72 },
        { x: 0.27, y: 0.67 },
        { x: 0.3, y: 0.63 },
        { x: 0.34, y: 0.61 },
      ],
    },
    {
      ...nodeBase(SEED_IDS.strokeB, ossian, 10),
      t: "stroke",
      color: "blue",
      width: DEFAULT_STROKE_WIDTH,
      points: [
        { x: 0.17, y: 0.76 },
        { x: 0.19, y: 0.68 },
        { x: 0.24, y: 0.6 },
        { x: 0.31, y: 0.55 },
        { x: 0.38, y: 0.53 },
      ],
    },
    {
      ...nodeBase(SEED_IDS.text, ossian, 11),
      t: "text",
      at: { x: 0.42, y: 0.3 },
      text: "Hold the ridge",
      color: "white",
      size: "md",
    },
  ];
}

const seedRequest = (
  over: Partial<SupplyRequest> & Pick<SupplyRequest, "id" | "kind" | "by" | "createdAt">,
): SupplyRequest => ({
  status: "open",
  priority: "normal",
  byName: BOT_NAME[over.by],
  claimedBy: null,
  claimedByName: null,
  claimedAt: null,
  deliveredAt: null,
  etaSec: null,
  at: null,
  note: "",
  layer: "team",
  ...over,
});

/** Seed requests with times relative to the epoch start (negative = before it). */
function seedRequests(): SupplyRequest[] {
  return [
    seedRequest({
      id: SEED_IDS.reqFuel,
      kind: "fuel",
      by: boston,
      createdAt: -45_000,
      at: { x: 0.4, y: 0.52 },
    }),
    seedRequest({
      id: SEED_IDS.reqMedical,
      kind: "medical",
      by: rook,
      createdAt: -20_000,
      at: { x: 0.52, y: 0.49 },
      priority: "urgent",
    }),
    seedRequest({
      id: SEED_IDS.reqAmmo,
      kind: "ammo",
      by: ossian,
      createdAt: -70_000,
      at: { x: 0.34, y: 0.6 },
      status: "claimed",
      claimedBy: krieger,
      claimedByName: "Krieger",
      claimedAt: -10_000,
      etaSec: 60,
    }),
  ];
}

/** Seed op bodies with relative times; `actor` is the authoring bot. */
export function seedItems(): ScenarioEvent[] {
  const items: ScenarioEvent[] = [];
  for (const m of DEMO_BOTS)
    items.push({
      at: 0,
      kind: "op",
      body: { t: "roster.upsert", member: m },
      actor: m.id,
      actorName: m.callsign,
    });
  for (const n of seedNodes())
    items.push({
      at: 0,
      kind: "op",
      body: { t: "node.add", nodes: [n] },
      actor: n.author,
      actorName: n.authorName,
    });
  for (const r of seedRequests())
    items.push({
      at: 0,
      kind: "op",
      body: { t: "request.add", request: r },
      actor: r.by,
      actorName: r.byName,
    });
  return items;
}

/** Shift every relative time field in a body by `base` (ms); never below 0 (epoch 0 is the hero). */
function absolutize(body: OpBody, base: number): OpBody {
  const abs = (v: number): number => Math.max(0, v + base);
  const t = (v: number | null): number | null => (v === null ? null : abs(v));
  switch (body.t) {
    case "node.add":
      return { ...body, nodes: body.nodes.map((n) => ({ ...n, createdAt: abs(n.createdAt) })) };
    case "request.add":
      return {
        ...body,
        request: {
          ...body.request,
          createdAt: abs(body.request.createdAt),
          claimedAt: t(body.request.claimedAt),
          deliveredAt: t(body.request.deliveredAt),
        },
      };
    case "request.update": {
      const patch = { ...body.patch };
      if (patch.claimedAt !== undefined) patch.claimedAt = t(patch.claimedAt);
      if (patch.deliveredAt !== undefined) patch.deliveredAt = t(patch.deliveredAt);
      return { ...body, patch };
    }
    case "roster.upsert":
      return {
        ...body,
        member: {
          ...body.member,
          joinedAt: abs(body.member.joinedAt),
          lastSeen: abs(body.member.lastSeen),
        },
      };
    default:
      return body;
  }
}

/** Stamp scenario events as ops: ids from `ids`, ts = base + at, seq = firstSeq + index. */
export function stampItems(
  items: readonly ScenarioItem[],
  base: number,
  ids: () => string,
  firstSeq: number,
): Op[] {
  const out: Op[] = [];
  let i = 0;
  for (const item of items) {
    if (item.kind !== "op") continue;
    out.push({
      id: ids(),
      ts: base + item.at,
      actor: item.actor,
      seq: firstSeq + i,
      ...absolutize(item.body, base),
    });
    i++;
  }
  return out;
}

const seedCache = new Map<number, RoomState>();

/** code "DEMO", createdAt = epochIndex * DEMO_EPOCH_MS, Lonestar / Zestafona / Default, everyone draws. */
export function demoSeedState(epochIndex: number): RoomState {
  const cached = seedCache.get(epochIndex);
  if (cached) return cached;
  const base = epochIndex * DEMO_EPOCH_MS;
  const empty = createRoomState({
    code: DEMO_ROOM_CODE,
    settings: DEMO_SETTINGS,
    createdAt: base,
    actor: ossian,
  });
  const ops = stampItems(seedItems(), base, seededIds(epochIndex), 1);
  const state = applyOps(empty, ops);
  seedCache.set(epochIndex, state);
  return state;
}

// ---------------------------------------------------------------------------------------------
// Timeline (offsets in ms from the epoch start)

const ev = (at: number, actor: ClientId, body: OpBody): ScenarioEvent => ({
  at,
  kind: "op",
  body,
  actor,
  actorName: BOT_NAME[actor],
});
const ping = (at: number, by: ClientId, at2: { x: number; y: number }): ScenarioPing => ({
  at,
  kind: "ping",
  ping: {
    at: at2,
    by,
    byName: BOT_NAME[by],
    color: DEMO_BOTS.find((m) => m.id === by)?.ink ?? "blue",
    commander: by === ossian,
  },
});

const claimPatch = (by: ClientId, at: number, etaSec: number) => ({
  status: "claimed" as const,
  claimedBy: by,
  claimedByName: BOT_NAME[by],
  claimedAt: at,
  etaSec,
});
const deliverPatch = (at: number) => ({ status: "delivered" as const, deliveredAt: at });

export const DEMO_TIMELINE: readonly ScenarioItem[] = [
  ev(8_000, krieger, {
    t: "request.update",
    id: SEED_IDS.reqFuel,
    patch: claimPatch(krieger, 8_000, 60),
  }),
  ev(14_000, rook, {
    t: "node.add",
    nodes: [
      {
        ...nodeBase(TIMELINE_IDS.troops, rook, 14_000),
        t: "marker",
        kind: "enemy-troops",
        at: { x: 0.7, y: 0.3 },
        label: "2 squads",
        radius: null,
        team: "Valkyra",
      },
    ],
  }),
  ping(22_000, boston, { x: 0.44, y: 0.54 }),
  ev(30_000, ossian, {
    t: "node.add",
    nodes: [
      {
        ...nodeBase(TIMELINE_IDS.arrow, ossian, 30_000),
        t: "shape",
        shape: "arrow",
        color: "yellow",
        a: { x: 0.47, y: 0.5 },
        b: { x: 0.6, y: 0.4 },
      },
    ],
  }),
  ev(45_000, krieger, { t: "request.update", id: SEED_IDS.reqFuel, patch: deliverPatch(45_000) }),
  ev(60_000, boston, {
    t: "request.add",
    request: seedRequest({
      id: TIMELINE_IDS.medical,
      kind: "medical",
      by: boston,
      createdAt: 60_000,
      at: { x: 0.52, y: 0.49 },
      priority: "urgent",
    }),
  }),
  ev(75_000, rook, {
    t: "node.update",
    id: TIMELINE_IDS.troops,
    patch: { at: { x: 0.66, y: 0.33 } },
  }),
  ev(95_000, ossian, {
    t: "node.add",
    nodes: [
      {
        ...nodeBase(TIMELINE_IDS.text, ossian, 95_000),
        t: "text",
        at: { x: 0.5, y: 0.56 },
        text: "Push at 2:00",
        color: "white",
        size: "md",
      },
    ],
  }),
  ev(120_000, krieger, {
    t: "request.update",
    id: TIMELINE_IDS.medical,
    patch: claimPatch(krieger, 120_000, 30),
  }),
  ev(140_000, krieger, {
    t: "request.update",
    id: TIMELINE_IDS.medical,
    patch: deliverPatch(140_000),
  }),
  ping(160_000, ossian, ZONE_CENTRE),
  ev(180_000, rook, {
    t: "node.add",
    nodes: [
      {
        ...nodeBase(TIMELINE_IDS.danger, rook, 180_000),
        t: "marker",
        kind: "danger",
        at: { x: 0.75, y: 0.5 },
        label: "Mortars",
        radius: 0.04,
        team: null,
      },
    ],
  }),
  ev(210_000, boston, {
    t: "request.add",
    request: seedRequest({
      id: TIMELINE_IDS.ammo,
      kind: "ammo",
      by: boston,
      createdAt: 210_000,
      at: { x: 0.34, y: 0.6 },
    }),
  }),
  ev(240_000, krieger, {
    t: "request.update",
    id: TIMELINE_IDS.ammo,
    patch: claimPatch(krieger, 240_000, 30),
  }),
  ev(270_000, krieger, {
    t: "request.update",
    id: TIMELINE_IDS.ammo,
    patch: deliverPatch(270_000),
  }),
];

export const TIMELINE_FIRST_SEQ = 1000;

/** The "op" items stamped for an epoch: ids from seededIds(epochIndex * 7919 + 1), seq 1000 + index. */
export function timelineOps(epochIndex: number): Op[] {
  return stampItems(
    DEMO_TIMELINE,
    epochIndex * DEMO_EPOCH_MS,
    seededIds(epochIndex * 7919 + 1),
    TIMELINE_FIRST_SEQ,
  );
}

/** Seed of the current epoch plus every timeline op due by `now`; `nextIndex` indexes DEMO_TIMELINE. */
export function stateAt(now: number): { state: RoomState; nextIndex: number } {
  const idx = epochIndex(now);
  const elapsed = now - epochStart(now);
  const ops = timelineOps(idx);
  const due: Op[] = [];
  let nextIndex = DEMO_TIMELINE.length;
  let opI = 0;
  for (let i = 0; i < DEMO_TIMELINE.length; i++) {
    const item = DEMO_TIMELINE[i];
    if (item.at > elapsed) {
      nextIndex = i;
      break;
    }
    if (item.kind === "op") due.push(ops[opI++]);
  }
  return { state: applyOps(demoSeedState(idx), due), nextIndex };
}

/** The four bots, seen just now, no cursor — fed to the store every 10 s so they count as online. */
export function botPresence(now: number): Presence[] {
  return DEMO_BOTS.map((m) => ({ client: m.id, callsign: m.callsign, seenAt: now, cursor: null }));
}

// ---------------------------------------------------------------------------------------------
// Hero: the seed plan appearing node by node over ~5 s, then 8 items at 2.5 s spacing; loops.

export const HERO_NODE_STEP_MS = 450;
export const HERO_ITEM_STEP_MS = 2_500;

function heroItems(): ScenarioItem[] {
  const nodes = seedNodes();
  const items: ScenarioItem[] = nodes.map((n, i) =>
    ev(i * HERO_NODE_STEP_MS, n.author, { t: "node.add", nodes: [n] }),
  );
  const start = nodes.length * HERO_NODE_STEP_MS + 500;
  const at = (k: number) => start + k * HERO_ITEM_STEP_MS;
  items.push(
    ev(at(0), rook, {
      t: "node.add",
      nodes: [
        {
          ...nodeBase(TIMELINE_IDS.troops, rook, at(0)),
          t: "marker",
          kind: "enemy-troops",
          at: { x: 0.7, y: 0.3 },
          label: "2 squads",
          radius: null,
          team: "Valkyra",
        },
      ],
    }),
    ping(at(1), boston, { x: 0.44, y: 0.54 }),
    ev(at(2), ossian, {
      t: "node.add",
      nodes: [
        {
          ...nodeBase(TIMELINE_IDS.arrow, ossian, at(2)),
          t: "shape",
          shape: "arrow",
          color: "yellow",
          a: { x: 0.47, y: 0.5 },
          b: { x: 0.6, y: 0.4 },
        },
      ],
    }),
    ev(at(3), rook, {
      t: "node.update",
      id: TIMELINE_IDS.troops,
      patch: { at: { x: 0.66, y: 0.33 } },
    }),
    ev(at(4), ossian, {
      t: "node.add",
      nodes: [
        {
          ...nodeBase(TIMELINE_IDS.text, ossian, at(4)),
          t: "text",
          at: { x: 0.5, y: 0.56 },
          text: "Push at 2:00",
          color: "white",
          size: "md",
        },
      ],
    }),
    ping(at(5), ossian, ZONE_CENTRE),
    ev(at(6), rook, {
      t: "node.add",
      nodes: [
        {
          ...nodeBase(TIMELINE_IDS.danger, rook, at(6)),
          t: "marker",
          kind: "danger",
          at: { x: 0.75, y: 0.5 },
          label: "Mortars",
          radius: 0.04,
          team: null,
        },
      ],
    }),
    ev(at(7), krieger, {
      t: "node.add",
      nodes: [
        {
          ...nodeBase(TIMELINE_IDS.heroLz, krieger, at(7)),
          t: "marker",
          kind: "lz",
          at: { x: 0.28, y: 0.44 },
          label: "LZ CHARLIE",
          radius: null,
          team: null,
        },
      ],
    }),
  );
  return items;
}

export const HERO_TIMELINE: readonly ScenarioItem[] = heroItems();
/** Total length of one hero loop (ms): the last item plus one step. */
export const HERO_LOOP_MS = HERO_TIMELINE[HERO_TIMELINE.length - 1].at + HERO_ITEM_STEP_MS;

/** The hero's ops for one loop (epoch 0, deterministic ids, seq 1000+). */
export function heroOps(): Op[] {
  return stampItems(HERO_TIMELINE, 0, seededIds(31_337), TIMELINE_FIRST_SEQ);
}

/** An empty demo room (settings + bots, no nodes) — where the hero player starts each loop. */
export function heroStartState(): RoomState {
  const seed = demoSeedState(0);
  return { ...seed, nodes: {}, order: [], requests: {} };
}

/** demoSeedState(0) with every HERO_TIMELINE op applied — what HeroStatic renders. */
export function heroFinalState(): RoomState {
  const s = applyOps(demoSeedState(0), heroOps());
  return { ...s, order: canonicalOrder(s.nodes) };
}
