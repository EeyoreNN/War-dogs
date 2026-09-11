// The room store (§5.1): the only place that mutates room state. A plain zustand store; React
// components subscribe with selectors and call actions — never `useRoomStore.setState`.
import { create, type StoreApi, type UseBoundStore } from "zustand";
import {
  createHistory,
  popRedo,
  popUndo,
  pushHistory,
  type History,
  type HistoryEntry,
} from "@/lib/map/history";
import { newId } from "@/lib/map/ids";
import { applyOp, createRoomState, inverseOf, mergeStates, nextSeq } from "@/lib/map/reduce";
import { isCommand, singleWriter, successor } from "@/lib/map/roster";
import { demoRelayRoom } from "@/lib/map/scenario";
import { enemyTeams } from "@/lib/map/teams";
import {
  DEFAULT_SQUADS,
  MAX_NODES_PER_OP,
  PEER_TTL_MS,
  type ClientId,
  type Identity,
  type InkColor,
  type MapNode,
  type MarkerKind,
  type Op,
  type OpBody,
  type Ping,
  type Point,
  type Presence,
  type RoomSettings,
  type RoomState,
  type RosterMember,
  type SyncStatus,
  type Team,
  type Tool,
} from "@/lib/map/types";
import {
  createTransport,
  resolveRelayUrl,
  type Transport,
  type TransportOptions,
} from "@/lib/realtime";
import {
  chunkMap,
  createMapAssembler,
  type MapChunk,
  type MapMeta,
} from "@/lib/realtime/map-chunks";
import { getMap, putMap } from "@/lib/storage/idb";
import { saveIdentity } from "@/lib/storage/identity";
import { loadPrefs, savePrefs } from "@/lib/storage/prefs";
import { loadRoomResult, saveRoom } from "@/lib/storage/room";
import { touchRecentRoom } from "@/lib/storage/rooms";
import { housekeepingOps } from "./housekeeping";
import { COPY, notify } from "./notify";
import { canDispatch, type Mode } from "./permissions";

export const PING_TTL_MS = 4_000;
export const PERSIST_DEBOUNCE_MS = 500;
export const EMPTY_AFTER_MS = 1_500;
export const TICK_MS = 5_000;
export const BAD_FRAME_TOAST_MS = 60_000;

export type UploadedMapStatus = "ready" | "missing" | "receiving" | "mismatch";

export interface DispatchOptions {
  /** Default true: push the inverse onto the undo stack. */
  undoable?: boolean;
  /** Single-writer housekeeping (§5.5): skips the permission table and never enters history. */
  housekeeping?: boolean;
}

type TransportFactory = (opts: TransportOptions) => Transport;
let transportFactory: TransportFactory = createTransport;
/** Test seam: build transports on an in-memory bus instead of BroadcastChannel / WebSocket. */
export function setTransportFactory(fn: TransportFactory | null): void {
  transportFactory = fn ?? createTransport;
}

/** The body of an op without its meta (for redo). */
export function bodyOf(op: Op): OpBody {
  const rest = { ...op } as Record<string, unknown>;
  delete rest.ts;
  delete rest.actor;
  delete rest.seq;
  if (
    op.t === "node.add" ||
    op.t === "layer.clear" ||
    op.t === "request.add" ||
    op.t === "roster.upsert" ||
    op.t === "settings.update"
  )
    delete rest.id;
  return rest as unknown as OpBody;
}

export interface RoomStore {
  code: string | null;
  room: string | null;
  mode: Mode;
  state: RoomState | null;
  me: Identity | null;
  sync: SyncStatus;
  peers: number;
  presence: Record<string, Presence>;
  activity: Record<string, number>;
  pings: Ping[];
  history: History;
  queued: number;
  kicked: boolean;
  storageOk: boolean;
  // UI (not persisted except via prefs)
  tool: Tool;
  ink: InkColor;
  markerKind: MarkerKind;
  enemyTeam: Team;
  selection: string | null;
  highlightId: string | null;
  brief: boolean;
  grid: boolean;
  showPings: boolean;
  sound: boolean;
  // Extra surface for the UI's empty / error states (§4.3.9)
  /** No local state and no snapshot after 1.5 s: show "Nothing here yet". */
  awaitingPlan: boolean;
  roomFull: boolean;
  rateLimitStrikes: number;
  /** The single-writer promoted me; the UI shows "You are now commander" with OK / Decline. */
  pendingPromotion: boolean;
  /** Whether the commander's uploaded map blob is available locally. */
  uploadedMap: { hash: string; status: UploadedMapStatus } | null;
  // actions
  boot(args: {
    code: string;
    mode: Mode;
    identity: Identity;
    joinHint?: { team?: string; squad?: string };
    room?: string;
    seed?: RoomState;
  }): Promise<void>;
  dispatch(body: OpBody, opts?: DispatchOptions): Op | null;
  dispatchMany(bodies: OpBody[], opts?: DispatchOptions): Op[];
  ingest(op: Op): void;
  ingestPresence(members: Presence[]): void;
  undo(): void;
  redo(): void;
  ping(at: Point): void;
  setTool(t: Tool): void;
  setInk(c: InkColor): void;
  setMarkerKind(k: MarkerKind): void;
  setEnemyTeam(t: Team): void;
  select(id: string | null): void;
  highlight(id: string | null): void;
  setBrief(b: boolean): void;
  setGrid(b: boolean): void;
  setShowPings(b: boolean): void;
  setSound(b: boolean): void;
  updateIdentity(patch: Partial<Identity>): void;
  leave(): void;
  /** "Start a fresh plan here" (§4.3.9): a new state with me as commander. */
  startFresh(settings?: Partial<RoomSettings>): void;
  acceptPromotion(): void;
  declinePromotion(): void;
  /** Demo "Clear mine": removes everything I authored, in batches (§4.2). */
  clearMine(): number;
  /** Ask any holder (a peer or the relay cache) for the uploaded map (§5.7). */
  requestMap(): void;
  /** Broadcast the shared JPEG bytes in 48 kB chunks (§5.7). */
  shareMap(bytes: Uint8Array, meta: MapMeta): void;
}

interface Internals {
  transport: Transport | null;
  persistTimer: ReturnType<typeof setTimeout> | null;
  emptyTimer: ReturnType<typeof setTimeout> | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  pingTimers: Set<ReturnType<typeof setTimeout>>;
  unsubscribe: (() => void)[];
  announced: boolean;
  everConnecting: boolean;
  lastBadFrameToast: number;
  drawRequestedAt: Record<string, number>;
  ticks: number;
  assembler: ReturnType<typeof createMapAssembler>;
  mapRetried: boolean;
  session: number;
}

const internals: Internals = {
  transport: null,
  persistTimer: null,
  emptyTimer: null,
  tickTimer: null,
  pingTimers: new Set(),
  unsubscribe: [],
  announced: false,
  everConnecting: false,
  lastBadFrameToast: 0,
  drawRequestedAt: {},
  ticks: 0,
  assembler: createMapAssembler(),
  mapRetried: false,
  session: 0,
};

declare global {
  interface Window {
    __wardogs?: { now?: () => number; store?: UseBoundStore<StoreApi<RoomStore>> };
  }
}

/** Wall clock, or the test hook `window.__wardogs.now` when present (§4.2). */
export function now(): number {
  if (typeof window !== "undefined") {
    const n = window.__wardogs?.now;
    if (typeof n === "function") return n();
  }
  return Date.now();
}

const DEFAULT_SETTINGS: RoomSettings = {
  team: "Lonestar",
  map: "zestafona",
  controlZone: "default",
  squadMode: false,
  squads: [...DEFAULT_SQUADS],
  drawAccess: "everyone",
  mapSource: { kind: "builtin" },
};

const countPeers = (
  presence: Record<string, Presence>,
  self: ClientId | null,
  t: number,
): number => {
  const ids = new Set<string>();
  for (const p of Object.values(presence)) if (t - p.seenAt < PEER_TTL_MS) ids.add(p.client);
  if (self) ids.add(self);
  return ids.size;
};

/** Any applied change writes revs or tombstones; a bumped seq alone is "ignored". */
const changed = (before: RoomState, after: RoomState): boolean =>
  after.revs !== before.revs || after.tombstones !== before.tombstones;

export const useRoomStore: UseBoundStore<StoreApi<RoomStore>> = create<RoomStore>()((set, get) => {
  const clearTimers = () => {
    if (internals.persistTimer !== null) clearTimeout(internals.persistTimer);
    internals.persistTimer = null;
    if (internals.emptyTimer !== null) clearTimeout(internals.emptyTimer);
    internals.emptyTimer = null;
    if (internals.tickTimer !== null) clearInterval(internals.tickTimer);
    internals.tickTimer = null;
    for (const t of internals.pingTimers) clearTimeout(t);
    internals.pingTimers.clear();
  };

  const persistNow = () => {
    internals.persistTimer = null;
    const s = get();
    if (!s.state || !s.code || s.mode === "demo") return;
    const r = saveRoom(s.code, { v: 1, state: s.state, savedAt: now() });
    if (r.trimmed > 0) notify(COPY.trimmed, "warn");
    if (!r.ok) {
      if (s.storageOk) {
        set({ storageOk: false });
        notify(COPY.storageFull, "warn");
      }
      return;
    }
    const me = s.me ? s.state.roster[s.me.client] : undefined;
    touchRecentRoom({
      code: s.code,
      team: s.state.settings.team,
      map: s.state.settings.map,
      controlZone: s.state.settings.controlZone,
      role: me?.role ?? "member",
      updatedAt: now(),
    });
  };

  const persist = () => {
    if (get().mode === "demo") return;
    if (internals.persistTimer !== null) return;
    internals.persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
  };

  const stampPresence = (client: ClientId, callsign?: string, cursor?: Point | null) => {
    const t = now();
    set((s) => {
      const prev = s.presence[client];
      const next: Presence = {
        client,
        callsign: callsign ?? prev?.callsign ?? s.state?.roster[client]?.callsign ?? "",
        seenAt: t,
        cursor: cursor === undefined ? (prev?.cursor ?? null) : cursor,
      };
      const presence = { ...s.presence, [client]: next };
      return { presence, peers: countPeers(presence, s.me?.client ?? null, t) };
    });
  };

  const trackDrawRequests = (state: RoomState) => {
    const t = now();
    for (const m of Object.values(state.roster)) {
      if (m.drawRequested) {
        if (internals.drawRequestedAt[m.id] === undefined) internals.drawRequestedAt[m.id] = t;
      } else delete internals.drawRequestedAt[m.id];
    }
  };

  /** roster.update of self when known, else roster.upsert as member (commander for an empty roster). */
  const announceSelf = () => {
    const s = get();
    if (!s.state || !s.me || internals.announced) return;
    internals.announced = true;
    const me = s.me;
    const existing = s.state.roster[me.client];
    if (existing) {
      const patch: Partial<RosterMember> = {
        online: true,
        callsign: me.callsign,
        focus: me.focus,
        ink: me.ink,
        lastSeen: now(),
      };
      get().dispatch({ t: "roster.update", id: me.client, patch }, { undoable: false });
      return;
    }
    const hasCommander = Object.values(s.state.roster).some((m) => m.role === "commander");
    const member: RosterMember = {
      id: me.client,
      callsign: me.callsign,
      role: hasCommander || s.mode === "demo" ? "member" : "commander",
      focus: me.focus,
      online: true,
      ink: me.ink,
      canDraw: s.state.settings.drawAccess === "everyone",
      drawRequested: false,
      joinedAt: now(),
      lastSeen: now(),
    };
    get().dispatch({ t: "roster.upsert", member }, { undoable: false });
  };

  const applyRemote = (op: Op) => {
    const s = get();
    if (!s.state) return;
    const next = applyOp(s.state, op);
    const t = now();
    const activity = { ...s.activity, [op.actor]: t };
    if (next === s.state) {
      set({ activity });
      return;
    }
    const me = s.me;
    const patch: Partial<RoomStore> = { state: next, activity };
    if (me) {
      if (op.t === "roster.remove" && op.id === me.client && s.state.roster[me.client]) {
        patch.kicked = true;
      }
      if (op.t === "roster.update" && op.id === me.client && op.actor !== me.client) {
        const before = s.state.roster[me.client];
        const after = next.roster[me.client];
        if (before && after) {
          if (before.canDraw !== after.canDraw && s.state.settings.drawAccess === "request") {
            notify(
              after.canDraw ? COPY.canDrawNow : COPY.drawDenied,
              after.canDraw ? "ok" : "warn",
            );
          }
          if (
            before.drawRequested &&
            !after.drawRequested &&
            !after.canDraw &&
            s.state.settings.drawAccess === "request" &&
            before.canDraw === after.canDraw
          ) {
            notify(COPY.drawDenied, "warn");
          }
          if (before.role !== "commander" && after.role === "commander")
            patch.pendingPromotion = true;
        }
      }
    }
    trackDrawRequests(next);
    set(patch);
    if (patch.kicked) {
      internals.transport?.leave();
    }
    persist();
  };

  const sendOp = (op: Op) => {
    const t = internals.transport;
    if (!t) return;
    t.send(op);
    if (t.kind === "ws" && t.status !== "live") set((s) => ({ queued: s.queued + 1 }));
  };

  const stampMeta = (body: OpBody, state: RoomState, me: Identity): Op =>
    ({ id: newId(), ts: now(), actor: me.client, seq: nextSeq(state), ...body }) as Op;

  const bodyWithinCaps = (body: OpBody): boolean => {
    if (body.t === "node.add")
      return body.nodes.length >= 1 && body.nodes.length <= MAX_NODES_PER_OP;
    if (body.t === "node.remove")
      return body.ids.length >= 1 && body.ids.length <= MAX_NODES_PER_OP;
    return true;
  };

  const runHousekeeping = () => {
    const s = get();
    if (!s.state || !s.me || s.mode === "demo" || s.kicked) return;
    const writer = singleWriter(Object.values(s.state.roster), s.presence, now());
    if (writer !== s.me.client) return;
    const ops = housekeepingOps({
      state: s.state,
      presence: s.presence,
      now: now(),
      drawRequestedAt: internals.drawRequestedAt,
    });
    for (const body of ops) get().dispatch(body, { undoable: false, housekeeping: true });
  };

  /** My own presence record (self counts for `peers` and for the single-writer election). */
  const stampSelf = () => {
    const s = get();
    if (s.me) stampPresence(s.me.client, s.me.callsign);
  };

  const tick = () => {
    internals.ticks++;
    stampSelf();
    const t = now();
    const s = get();
    const pings = s.pings.filter((p) => t - p.ts < PING_TTL_MS);
    const peers = countPeers(s.presence, s.me?.client ?? null, t);
    if (pings.length !== s.pings.length || peers !== s.peers) set({ pings, peers });
    if (internals.ticks % 2 === 0) runHousekeeping();
  };

  const wireTransport = (t: Transport, session: number) => {
    const alive = () => internals.session === session;
    internals.unsubscribe = [
      t.onOp((op) => {
        if (!alive()) return;
        stampPresence(op.actor);
        get().ingest(op);
      }),
      t.onOps((ops) => {
        if (!alive()) return;
        for (const op of ops) get().ingest(op);
      }),
      t.onSnapshot((remote) => {
        if (!alive()) return;
        const s = get();
        const merged = s.state ? mergeStates(s.state, remote) : remote;
        if (internals.emptyTimer !== null) clearTimeout(internals.emptyTimer);
        internals.emptyTimer = null;
        trackDrawRequests(merged);
        set({
          state: merged,
          awaitingPlan: false,
          enemyTeam: s.state ? s.enemyTeam : enemyTeams(merged.settings.team)[0],
        });
        announceSelf();
        persist();
      }),
      t.onPresence((members) => {
        if (alive()) get().ingestPresence(members);
      }),
      t.onEphemeral((msg) => {
        if (!alive()) return;
        const s = get();
        switch (msg.k) {
          case "ping": {
            if (s.me && msg.ping.by === s.me.client) return;
            stampPresence(msg.ping.by, msg.ping.byName);
            addPing({ ...msg.ping, ts: now() });
            break;
          }
          case "cursor": {
            stampPresence(msg.client, undefined, msg.at);
            if (msg.at) set((st) => ({ activity: { ...st.activity, [msg.client]: now() } }));
            break;
          }
          case "map.request": {
            void answerMapRequest(msg.hash);
            break;
          }
          case "map.chunk": {
            void receiveChunk(msg);
            break;
          }
        }
      }),
      t.onStatus((status) => {
        if (!alive()) return;
        const s = get();
        const patch: Partial<RoomStore> = { sync: status };
        if (status === "live") patch.queued = 0;
        if (status === "connecting") internals.everConnecting = true;
        if (status === "local" && internals.everConnecting && s.sync !== "local") {
          internals.everConnecting = false;
          notify(COPY.relayUnreachable, "warn");
        }
        set(patch);
      }),
      t.onError((err) => {
        if (!alive()) return;
        switch (err.code) {
          case "room-full":
            set({ roomFull: true });
            break;
          case "rate-limit":
            set((s) => ({ rateLimitStrikes: s.rateLimitStrikes + 1 }));
            notify(COPY.rateLimit, "warn");
            break;
          case "bad-frame": {
            const t0 = now();
            if (t0 - internals.lastBadFrameToast >= BAD_FRAME_TOAST_MS) {
              internals.lastBadFrameToast = t0;
              notify(COPY.badFrame, "warn");
            }
            break;
          }
          case "kicked":
            set({ kicked: true });
            break;
        }
      }),
    ];
  };

  const addPing = (ping: Ping) => {
    set((s) => ({ pings: [...s.pings.filter((p) => now() - p.ts < PING_TTL_MS), ping] }));
    const timer = setTimeout(() => {
      internals.pingTimers.delete(timer);
      set((s) => ({ pings: s.pings.filter((p) => p.id !== ping.id) }));
    }, PING_TTL_MS);
    internals.pingTimers.add(timer);
  };

  const answerMapRequest = async (hash: string) => {
    const s = get();
    if (
      !s.state ||
      s.state.settings.mapSource.kind !== "upload" ||
      s.state.settings.mapSource.hash !== hash
    )
      return;
    if (s.uploadedMap?.status !== "ready") return;
    const rec = await getMap(hash);
    if (!rec) return;
    const bytes = new Uint8Array(await rec.shared.arrayBuffer());
    get().shareMap(bytes, { hash, mime: rec.mime, w: rec.w, h: rec.h });
  };

  const receiveChunk = async (msg: MapChunk) => {
    const s = get();
    const source = s.state?.settings.mapSource;
    if (!source || source.kind !== "upload" || source.hash !== msg.hash) return;
    if (s.uploadedMap?.status === "ready" && s.uploadedMap.hash === msg.hash) return;
    set({ uploadedMap: { hash: msg.hash, status: "receiving" } });
    const result = await internals.assembler.push(msg);
    if (result.status === "complete") {
      const blob = new Blob([result.map.bytes as BlobPart], { type: result.map.mime });
      await putMap(msg.hash, {
        shared: blob,
        full: null,
        w: result.map.w,
        h: result.map.h,
        mime: result.map.mime,
        name: source.name,
        at: now(),
      });
      internals.mapRetried = false;
      set({ uploadedMap: { hash: msg.hash, status: "ready" } });
    } else if (result.status === "mismatch") {
      set({ uploadedMap: { hash: msg.hash, status: "mismatch" } });
      if (!internals.mapRetried) {
        internals.mapRetried = true;
        notify(COPY.mapMismatch, "warn");
        get().requestMap();
      }
    }
  };

  const checkUploadedMap = async (state: RoomState) => {
    const source = state.settings.mapSource;
    if (source.kind !== "upload") {
      if (get().uploadedMap) set({ uploadedMap: null });
      return;
    }
    const current = get().uploadedMap;
    if (current && current.hash === source.hash && current.status !== "missing") return;
    const rec = await getMap(source.hash);
    if (get().state?.settings.mapSource !== source) return;
    if (rec) set({ uploadedMap: { hash: source.hash, status: "ready" } });
    else {
      set({ uploadedMap: { hash: source.hash, status: "missing" } });
      get().requestMap();
    }
  };

  return {
    code: null,
    room: null,
    mode: "room",
    state: null,
    me: null,
    sync: "local",
    peers: 0,
    presence: {},
    activity: {},
    pings: [],
    history: createHistory(),
    queued: 0,
    kicked: false,
    storageOk: true,
    tool: "select",
    ink: "blue",
    markerKind: "fob",
    enemyTeam: "Valkyra",
    selection: null,
    highlightId: null,
    brief: false,
    grid: true,
    showPings: true,
    sound: false,
    awaitingPlan: false,
    roomFull: false,
    rateLimitStrikes: 0,
    pendingPromotion: false,
    uploadedMap: null,

    async boot(args) {
      get().leave();
      const session = ++internals.session;
      internals.announced = false;
      internals.everConnecting = false;
      internals.drawRequestedAt = {};
      internals.ticks = 0;
      internals.mapRetried = false;
      const prefs = loadPrefs();
      const room = args.room ?? (args.mode === "demo" ? demoRelayRoom(now()) : args.code);
      let state: RoomState | null = args.seed ?? null;
      if (!state && args.mode !== "demo") {
        const r = loadRoomResult(args.code);
        state = r.snapshot?.state ?? null;
        if (r.status === "corrupt") notify(COPY.corruptSnapshot, "warn");
      }
      if (state) trackDrawRequests(state);
      set({
        code: args.code,
        room,
        mode: args.mode,
        state,
        me: args.identity,
        sync: "local",
        peers: 1,
        presence: {},
        activity: {},
        pings: [],
        history: createHistory(),
        queued: 0,
        kicked: false,
        storageOk: true,
        tool: prefs.lastTool,
        ink: args.identity.ink,
        markerKind: "fob",
        enemyTeam: enemyTeams(state?.settings.team ?? DEFAULT_SETTINGS.team)[0],
        selection: null,
        highlightId: null,
        brief: prefs.brief,
        grid: prefs.grid,
        showPings: prefs.showPings,
        sound: prefs.sound,
        awaitingPlan: false,
        roomFull: false,
        rateLimitStrikes: 0,
        pendingPromotion: false,
        uploadedMap: null,
      });
      const relayUrl = resolveRelayUrl();
      const transport = transportFactory({ relayUrl, getState: () => get().state });
      internals.transport = transport;
      wireTransport(transport, session);
      internals.tickTimer = setInterval(tick, TICK_MS);
      stampSelf();
      if (typeof window !== "undefined") {
        const onHide = () => {
          if (internals.session === session) {
            if (internals.persistTimer !== null) {
              clearTimeout(internals.persistTimer);
              persistNow();
            }
            internals.transport?.leave();
          }
        };
        window.addEventListener("pagehide", onHide);
        internals.unsubscribe.push(() => window.removeEventListener("pagehide", onHide));
      }
      if (state) {
        announceSelf();
        void checkUploadedMap(state);
      } else {
        internals.emptyTimer = setTimeout(() => {
          internals.emptyTimer = null;
          if (internals.session === session && !get().state) set({ awaitingPlan: true });
        }, EMPTY_AFTER_MS);
      }
      await transport.join(room, args.identity, state?.seq ?? 0, state);
    },

    dispatch(body, opts) {
      const s = get();
      if (!s.state || !s.me || s.kicked) return null;
      if (!bodyWithinCaps(body)) return null;
      const housekeeping = opts?.housekeeping === true;
      const me = s.state.roster[s.me.client] ?? null;
      if (!housekeeping && !canDispatch(body, me, s.state, s.me.client, s.mode)) return null;
      const op = stampMeta(body, s.state, s.me);
      const next = applyOp(s.state, op);
      if (!changed(s.state, next)) return null;
      const undoable = opts?.undoable !== false && !housekeeping;
      let history = s.history;
      if (undoable) {
        const inverse = inverseOf(s.state, op);
        if (inverse && inverse.length) history = pushHistory(history, { op, inverse });
      }
      trackDrawRequests(next);
      set({ state: next, history, activity: { ...s.activity, [s.me.client]: now() } });
      if (body.t === "settings.update" && body.patch.mapSource !== undefined)
        void checkUploadedMap(next);
      persist();
      sendOp(op);
      return op;
    },

    dispatchMany(bodies, opts) {
      const ops: Op[] = [];
      const inverses: OpBody[] = [];
      for (const body of bodies) {
        const before = get().state;
        const op = get().dispatch(body, { ...opts, undoable: false });
        if (!op) continue;
        ops.push(op);
        if (opts?.undoable !== false && before) {
          const inv = inverseOf(before, op);
          if (inv) inverses.unshift(...inv.slice().reverse());
        }
      }
      if (ops.length && opts?.undoable !== false && inverses.length) {
        set((s) => ({
          history: pushHistory(s.history, { op: ops[0], inverse: inverses, batch: ops }),
        }));
      }
      return ops;
    },

    ingest(op) {
      applyRemote(op);
    },

    ingestPresence(members) {
      const t = now();
      set((s) => {
        const presence = { ...s.presence };
        const activity = { ...s.activity };
        for (const m of members) {
          presence[m.client] = {
            client: m.client,
            callsign:
              m.callsign ||
              presence[m.client]?.callsign ||
              s.state?.roster[m.client]?.callsign ||
              "",
            seenAt: t,
            cursor: m.cursor,
          };
          if (m.cursor) activity[m.client] = t;
        }
        return { presence, activity, peers: countPeers(presence, s.me?.client ?? null, t) };
      });
    },

    undo() {
      const s = get();
      const { history, entry } = popUndo(s.history);
      if (!entry) return;
      set({ history });
      for (const body of entry.inverse) get().dispatch(body, { undoable: false });
    },

    redo() {
      const s = get();
      const { history, entry } = popRedo(s.history);
      if (!entry) return;
      set({ history });
      for (const op of entry.batch ?? [entry.op]) get().dispatch(bodyOf(op), { undoable: false });
    },

    ping(at) {
      const s = get();
      if (!s.me || !s.room) return;
      const me = s.state?.roster[s.me.client] ?? null;
      const ping: Ping = {
        id: newId(),
        at,
        by: s.me.client,
        byName: s.me.callsign,
        color: s.me.ink,
        ts: now(),
        commander: isCommand(me),
      };
      addPing(ping);
      set((st) => ({ activity: { ...st.activity, [ping.by]: now() } }));
      internals.transport?.sendEphemeral({ k: "ping", room: s.room, ping });
    },

    setTool(tool) {
      set({ tool });
      savePrefs({ lastTool: tool });
    },
    setInk(ink) {
      set({ ink });
      const s = get();
      if (s.me && s.me.ink !== ink) get().updateIdentity({ ink });
    },
    setMarkerKind(markerKind) {
      set({ markerKind });
    },
    setEnemyTeam(enemyTeam) {
      set({ enemyTeam });
    },
    select(selection) {
      set({ selection });
    },
    highlight(highlightId) {
      set({ highlightId });
    },
    setBrief(brief) {
      set({ brief });
      savePrefs({ brief });
    },
    setGrid(grid) {
      set({ grid });
      savePrefs({ grid });
    },
    setShowPings(showPings) {
      set({ showPings });
      savePrefs({ showPings });
    },
    setSound(sound) {
      set({ sound });
      savePrefs({ sound });
    },

    updateIdentity(patch) {
      const s = get();
      if (!s.me) return;
      const me: Identity = { ...s.me, ...patch, client: s.me.client };
      saveIdentity(me);
      set({ me, ink: me.ink });
      const rosterPatch: Partial<RosterMember> = {};
      if (patch.callsign !== undefined) rosterPatch.callsign = me.callsign;
      if (patch.focus !== undefined) rosterPatch.focus = me.focus;
      if (patch.ink !== undefined) rosterPatch.ink = me.ink;
      if (Object.keys(rosterPatch).length && s.state?.roster[me.client]) {
        get().dispatch(
          { t: "roster.update", id: me.client, patch: rosterPatch },
          { undoable: false },
        );
      }
    },

    leave() {
      internals.session++;
      if (internals.persistTimer !== null) {
        clearTimeout(internals.persistTimer);
        persistNow();
      }
      clearTimers();
      for (const u of internals.unsubscribe) u();
      internals.unsubscribe = [];
      internals.transport?.leave();
      internals.transport = null;
      internals.announced = false;
      set({
        code: null,
        room: null,
        state: null,
        sync: "local",
        peers: 0,
        presence: {},
        activity: {},
        pings: [],
        history: createHistory(),
        queued: 0,
        awaitingPlan: false,
        roomFull: false,
        pendingPromotion: false,
        selection: null,
        highlightId: null,
        uploadedMap: null,
      });
    },

    startFresh(settings) {
      const s = get();
      if (!s.code || !s.me || s.state) return;
      const state = createRoomState({
        code: s.code,
        settings: {
          ...DEFAULT_SETTINGS,
          ...settings,
          squads: [...(settings?.squads ?? DEFAULT_SETTINGS.squads)],
        },
        createdAt: now(),
        actor: s.me.client,
      });
      if (internals.emptyTimer !== null) clearTimeout(internals.emptyTimer);
      internals.emptyTimer = null;
      set({ state, awaitingPlan: false, enemyTeam: enemyTeams(state.settings.team)[0] });
      announceSelf();
      persist();
    },

    acceptPromotion() {
      set({ pendingPromotion: false });
    },

    declinePromotion() {
      const s = get();
      set({ pendingPromotion: false });
      if (!s.state || !s.me) return;
      const roster = Object.values(s.state.roster);
      const next = successor(roster, s.presence, now(), s.me.client);
      if (!next) return;
      get().dispatchMany(
        [
          { t: "roster.update", id: next.id, patch: { role: "commander" } },
          { t: "roster.update", id: s.me.client, patch: { role: "member" } },
        ],
        { undoable: false },
      );
    },

    clearMine() {
      const s = get();
      if (!s.state || !s.me) return 0;
      const mine = s.state.order.filter((id) => s.state!.nodes[id].author === s.me!.client);
      const bodies: OpBody[] = [];
      for (let i = 0; i < mine.length; i += MAX_NODES_PER_OP)
        bodies.push({ t: "node.remove", ids: mine.slice(i, i + MAX_NODES_PER_OP) });
      for (const r of Object.values(s.state.requests))
        if (r.by === s.me.client) bodies.push({ t: "request.remove", id: r.id });
      return get().dispatchMany(bodies, { undoable: false }).length;
    },

    requestMap() {
      const s = get();
      const source = s.state?.settings.mapSource;
      if (!s.room || !source || source.kind !== "upload") return;
      internals.transport?.sendEphemeral({ k: "map.request", room: s.room, hash: source.hash });
    },

    shareMap(bytes, meta) {
      const s = get();
      if (!s.room) return;
      for (const chunk of chunkMap(bytes, meta, s.room)) internals.transport?.sendEphemeral(chunk);
      set({ uploadedMap: { hash: meta.hash, status: "ready" } });
    },
  };
});

// ---------------------------------------------------------------------------------------------
// Selectors

const nodeSelectors = new Map<string, (s: RoomStore) => MapNode | undefined>();
/** Per-id memoised selector: the same function for the same id, so subscriptions stay stable. */
export const selectNode = (id: string): ((s: RoomStore) => MapNode | undefined) => {
  let sel = nodeSelectors.get(id);
  if (!sel) {
    sel = (s) => s.state?.nodes[id];
    nodeSelectors.set(id, sel);
    if (nodeSelectors.size > 10_000) nodeSelectors.clear();
  }
  return sel;
};

export const selectMe = (s: RoomStore): RosterMember | null =>
  s.state && s.me ? (s.state.roster[s.me.client] ?? null) : null;

export const selectSettings = (s: RoomStore): RoomSettings | null => s.state?.settings ?? null;

/** Test hook: a fresh store per test without a page reload. */
export function resetRoomStore(): void {
  useRoomStore.getState().leave();
  useRoomStore.setState({
    me: null,
    mode: "room",
    storageOk: true,
    kicked: false,
    rateLimitStrikes: 0,
  });
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__wardogs = { ...(window.__wardogs ?? {}), store: useRoomStore };
}

export type { History, HistoryEntry };
