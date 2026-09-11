// The op-log reducer (§3.4). Pure, structural sharing, never throws on valid input.
// Relay-reachable: relative imports only (§3.0).
import { fieldKey, isFieldKeyOf, nodeKey, requestKey, rosterKey, settingKey } from "./keys";
import {
  MAX_NODES,
  MAX_NODES_PER_OP,
  type ClientId,
  type MapNode,
  type NodePatch,
  type NodeType,
  type Op,
  type OpBody,
  type RequestPatch,
  type Rev,
  type RoomSettings,
  type RoomState,
  type RosterMember,
  type RosterPatch,
  type SupplyRequest,
} from "./types";

/** Patch keys the reducer accepts per node type; every other key is dropped silently. */
export const NODE_FIELDS: Record<NodeType, readonly (keyof NodePatch)[]> = {
  stroke: ["color", "layer", "points"],
  shape: ["a", "b", "color", "layer"],
  marker: ["at", "label", "radius", "team", "layer"],
  text: ["at", "text", "color", "size", "layer"],
  measure: ["a", "b", "color", "layer"],
};
export const REQUEST_FIELDS: readonly (keyof RequestPatch)[] = [
  "status",
  "priority",
  "claimedBy",
  "claimedByName",
  "claimedAt",
  "deliveredAt",
  "etaSec",
  "at",
  "note",
  "kind",
];
export const ROSTER_FIELDS: readonly (keyof RosterPatch)[] = [
  "callsign",
  "role",
  "focus",
  "squad",
  "online",
  "ink",
  "canDraw",
  "drawRequested",
  "joinedAt",
  "lastSeen",
];
export const SETTINGS_FIELDS: readonly (keyof RoomSettings)[] = [
  "team",
  "map",
  "controlZone",
  "squadMode",
  "squads",
  "drawAccess",
  "mapSource",
];

// ---------------------------------------------------------------------------------------------
// Revs

/** seq asc, then actor asc (string compare); 0 only for the same op. */
export function compareRev(a: Rev, b: Rev): number {
  if (a.seq !== b.seq) return a.seq < b.seq ? -1 : 1;
  return a.actor < b.actor ? -1 : a.actor > b.actor ? 1 : 0;
}

/** rev beats `existing` when there is nothing there or rev is strictly greater. */
const beats = (rev: Rev, existing: Rev | undefined): boolean =>
  existing === undefined || compareRev(rev, existing) > 0;

/** true if `revs[key]` or `tombstones[key]` is >= rev (an equal rev is the same op: stale). */
export function isStale(state: RoomState, key: string, rev: Rev): boolean {
  return !beats(rev, state.revs[key]) || !beats(rev, state.tombstones[key]);
}

/** max(state.seq, incoming ?? 0) + 1 */
export function nextSeq(state: RoomState, incoming?: number): number {
  return Math.max(state.seq, incoming ?? 0) + 1;
}

/** Every node id sorted by (createdAt asc, id asc): the derived z-order. */
export function canonicalOrder(nodes: Record<string, MapNode>): string[] {
  return Object.keys(nodes).sort((a, b) => {
    const d = nodes[a].createdAt - nodes[b].createdAt;
    if (d !== 0) return d;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

export function createRoomState(init: {
  code: string;
  settings: RoomSettings;
  createdAt: number;
  actor: ClientId;
}): RoomState {
  const rev: Rev = { seq: 1, actor: init.actor };
  const revs: Record<string, Rev> = {};
  for (const f of SETTINGS_FIELDS) revs[settingKey(f)] = rev;
  return {
    v: 1,
    code: init.code,
    createdAt: init.createdAt,
    settings: { ...init.settings, squads: [...init.settings.squads] },
    nodes: {},
    order: [],
    requests: {},
    roster: {},
    revs,
    tombstones: {},
    seq: 1,
  };
}

// ---------------------------------------------------------------------------------------------
// Copy-on-write draft

interface Draft {
  base: RoomState;
  nodes: Record<string, MapNode>;
  requests: Record<string, SupplyRequest>;
  roster: Record<string, RosterMember>;
  revs: Record<string, Rev>;
  tombstones: Record<string, Rev>;
  settings: RoomSettings;
  w: { nodes: boolean; requests: boolean; roster: boolean; revs: boolean; tombstones: boolean; settings: boolean };
  /** ids were added or removed → `order` is recomputed. */
  nodeSetChanged: boolean;
}

function draftOf(base: RoomState): Draft {
  return {
    base,
    nodes: base.nodes,
    requests: base.requests,
    roster: base.roster,
    revs: base.revs,
    tombstones: base.tombstones,
    settings: base.settings,
    w: { nodes: false, requests: false, roster: false, revs: false, tombstones: false, settings: false },
    nodeSetChanged: false,
  };
}
const wNodes = (d: Draft) => {
  if (!d.w.nodes) {
    d.nodes = { ...d.nodes };
    d.w.nodes = true;
  }
  return d.nodes;
};
const wRequests = (d: Draft) => {
  if (!d.w.requests) {
    d.requests = { ...d.requests };
    d.w.requests = true;
  }
  return d.requests;
};
const wRoster = (d: Draft) => {
  if (!d.w.roster) {
    d.roster = { ...d.roster };
    d.w.roster = true;
  }
  return d.roster;
};
const wRevs = (d: Draft) => {
  if (!d.w.revs) {
    d.revs = { ...d.revs };
    d.w.revs = true;
  }
  return d.revs;
};
const wTombstones = (d: Draft) => {
  if (!d.w.tombstones) {
    d.tombstones = { ...d.tombstones };
    d.w.tombstones = true;
  }
  return d.tombstones;
};
const wSettings = (d: Draft) => {
  if (!d.w.settings) {
    d.settings = { ...d.settings };
    d.w.settings = true;
  }
  return d.settings;
};

function changed(d: Draft): boolean {
  const w = d.w;
  return w.nodes || w.requests || w.roster || w.revs || w.tombstones || w.settings;
}

function finish(d: Draft, seq: number): RoomState {
  const base = d.base;
  if (!changed(d)) return seq === base.seq ? base : { ...base, seq };
  return {
    ...base,
    settings: d.settings,
    nodes: d.nodes,
    order: d.nodeSetChanged ? canonicalOrder(d.nodes) : base.order,
    requests: d.requests,
    roster: d.roster,
    revs: d.revs,
    tombstones: d.tombstones,
    seq,
  };
}

/** Drop the entity rev and every `${key}:*` field rev. Field revs only exist while the entity does. */
function dropRevsOf(d: Draft, key: string): void {
  if (d.revs[key] === undefined) return;
  const revs = wRevs(d);
  delete revs[key];
  for (const k of Object.keys(revs)) if (isFieldKeyOf(key, k)) delete revs[k];
}

/** Add / upsert rule: applied iff rev beats the entity rev and the tombstone. */
function admitAdd(d: Draft, key: string, rev: Rev): boolean {
  if (!beats(rev, d.revs[key]) || !beats(rev, d.tombstones[key])) return false;
  dropRevsOf(d, key);
  wRevs(d)[key] = rev;
  if (d.tombstones[key] !== undefined) delete wTombstones(d)[key];
  return true;
}

/** Remove rule: applied iff rev beats the entity rev and the tombstone (field revs never block it). */
function admitRemove(d: Draft, key: string, rev: Rev): boolean {
  if (!beats(rev, d.revs[key]) || !beats(rev, d.tombstones[key])) return false;
  dropRevsOf(d, key);
  wTombstones(d)[key] = rev;
  return true;
}

/** Patch rule per field: written iff rev beats the entity rev and the field rev. Returns the new object or null. */
function patchFields<T extends object, K extends keyof T>(
  d: Draft,
  key: string,
  current: T,
  patch: Partial<Pick<T, K>>,
  fields: readonly K[],
  rev: Rev,
): T | null {
  const entityRev = d.revs[key];
  if (!beats(rev, entityRev)) return null;
  let next: T | null = null;
  for (const f of fields) {
    if (!Object.prototype.hasOwnProperty.call(patch, f)) continue;
    const v = patch[f];
    if (v === undefined) continue;
    const fk = fieldKey(key, f as string);
    if (!beats(rev, d.revs[fk])) continue;
    if (!next) next = { ...current };
    next[f] = v as T[K];
    wRevs(d)[fk] = rev;
  }
  return next;
}

/** Node cap: the oldest strokes by canonical order are dropped without tombstones (§3.4). */
function enforceNodeCap(d: Draft): void {
  let excess = Object.keys(d.nodes).length - MAX_NODES;
  if (excess <= 0) return;
  for (const id of canonicalOrder(d.nodes)) {
    if (excess <= 0) break;
    if (d.nodes[id].t !== "stroke") continue;
    delete wNodes(d)[id];
    dropRevsOf(d, nodeKey(id));
    d.nodeSetChanged = true;
    excess--;
  }
}

/** Ids of the nodes a cap pass would drop from `nodes` (what the single-writer removes for peers). */
export function nodesOverCap(nodes: Record<string, MapNode>): string[] {
  let excess = Object.keys(nodes).length - MAX_NODES;
  const out: string[] = [];
  if (excess <= 0) return out;
  for (const id of canonicalOrder(nodes)) {
    if (excess <= 0) break;
    if (nodes[id].t !== "stroke") continue;
    out.push(id);
    excess--;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// applyOp

export function applyOp(state: RoomState, op: Op): RoomState {
  const rev: Rev = { seq: op.seq, actor: op.actor };
  const seq = Math.max(state.seq, op.seq);
  const d = draftOf(state);
  switch (op.t) {
    case "node.add": {
      for (const node of op.nodes.slice(0, MAX_NODES_PER_OP)) {
        const key = nodeKey(node.id);
        if (!admitAdd(d, key, rev)) continue;
        wNodes(d)[node.id] = node;
        d.nodeSetChanged = true;
      }
      if (d.nodeSetChanged) enforceNodeCap(d);
      break;
    }
    case "node.update": {
      const node = d.nodes[op.id];
      if (!node) break;
      const next = patchFields(
        d,
        nodeKey(op.id),
        node as MapNode & NodePatch,
        op.patch as Partial<MapNode & NodePatch>,
        NODE_FIELDS[node.t] as readonly (keyof (MapNode & NodePatch))[],
        rev,
      );
      if (next) wNodes(d)[op.id] = next as MapNode;
      break;
    }
    case "node.remove": {
      for (const id of op.ids.slice(0, MAX_NODES_PER_OP)) {
        if (!admitRemove(d, nodeKey(id), rev)) continue;
        if (d.nodes[id]) {
          delete wNodes(d)[id];
          d.nodeSetChanged = true;
        }
      }
      break;
    }
    case "layer.clear": {
      for (const id of Object.keys(d.nodes)) {
        const node = d.nodes[id];
        if (node.layer !== op.layer) continue;
        if (op.types !== null && !op.types.includes(node.t)) continue;
        if (!admitRemove(d, nodeKey(id), rev)) continue;
        delete wNodes(d)[id];
        d.nodeSetChanged = true;
      }
      break;
    }
    case "request.add": {
      const key = requestKey(op.request.id);
      if (admitAdd(d, key, rev)) wRequests(d)[op.request.id] = op.request;
      break;
    }
    case "request.update": {
      const r = d.requests[op.id];
      if (!r) break;
      const next = patchFields(d, requestKey(op.id), r, op.patch, REQUEST_FIELDS, rev);
      if (next) wRequests(d)[op.id] = next;
      break;
    }
    case "request.remove": {
      if (admitRemove(d, requestKey(op.id), rev) && d.requests[op.id]) delete wRequests(d)[op.id];
      break;
    }
    case "roster.upsert": {
      const key = rosterKey(op.member.id);
      if (admitAdd(d, key, rev)) wRoster(d)[op.member.id] = op.member;
      break;
    }
    case "roster.update": {
      const m = d.roster[op.id];
      if (!m) break;
      const next = patchFields(d, rosterKey(op.id), m, op.patch, ROSTER_FIELDS, rev);
      if (next) wRoster(d)[op.id] = next;
      break;
    }
    case "roster.remove": {
      if (admitRemove(d, rosterKey(op.id), rev) && d.roster[op.id]) delete wRoster(d)[op.id];
      break;
    }
    case "settings.update": {
      for (const f of SETTINGS_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(op.patch, f)) continue;
        const v = op.patch[f];
        if (v === undefined) continue;
        const k = settingKey(f);
        if (!beats(rev, d.revs[k])) continue;
        (wSettings(d) as unknown as Record<string, unknown>)[f] = v;
        wRevs(d)[k] = rev;
      }
      break;
    }
  }
  return finish(d, seq);
}

export function applyOps(state: RoomState, ops: Op[]): RoomState {
  let s = state;
  for (const op of ops) s = applyOp(s, op);
  return s;
}

// ---------------------------------------------------------------------------------------------
// inverseOf

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Inverse bodies computed against the state BEFORE the op; null when not invertible. */
export function inverseOf(state: RoomState, op: Op): OpBody[] | null {
  const rev: Rev = { seq: op.seq, actor: op.actor };
  switch (op.t) {
    case "node.add": {
      const ids = op.nodes.filter((n) => !isStale(state, nodeKey(n.id), rev)).map((n) => n.id);
      return ids.length ? chunk(ids, MAX_NODES_PER_OP).map((c) => ({ t: "node.remove", ids: c })) : [];
    }
    case "node.update": {
      const node = state.nodes[op.id];
      if (!node) return [];
      const key = nodeKey(op.id);
      if (!beats(rev, state.revs[key])) return [];
      const prev: Record<string, unknown> = {};
      for (const f of NODE_FIELDS[node.t]) {
        if (!Object.prototype.hasOwnProperty.call(op.patch, f) || op.patch[f] === undefined) continue;
        if (!beats(rev, state.revs[fieldKey(key, f)])) continue;
        prev[f] = (node as unknown as Record<string, unknown>)[f];
      }
      return Object.keys(prev).length ? [{ t: "node.update", id: op.id, patch: prev as NodePatch }] : [];
    }
    case "node.remove": {
      const nodes = op.ids
        .filter((id) => state.nodes[id] && !isStale(state, nodeKey(id), rev))
        .map((id) => state.nodes[id]);
      return chunk(nodes, MAX_NODES_PER_OP).map((c) => ({ t: "node.add", nodes: c }));
    }
    case "layer.clear": {
      const nodes = state.order
        .map((id) => state.nodes[id])
        .filter(
          (n) =>
            n.layer === op.layer &&
            (op.types === null || op.types.includes(n.t)) &&
            !isStale(state, nodeKey(n.id), rev),
        );
      return chunk(nodes, MAX_NODES_PER_OP).map((c) => ({ t: "node.add", nodes: c }));
    }
    case "request.add":
      return isStale(state, requestKey(op.request.id), rev) ? [] : [{ t: "request.remove", id: op.request.id }];
    case "request.update": {
      const r = state.requests[op.id];
      if (!r) return [];
      const key = requestKey(op.id);
      if (!beats(rev, state.revs[key])) return [];
      const prev: Record<string, unknown> = {};
      for (const f of REQUEST_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(op.patch, f) || op.patch[f] === undefined) continue;
        if (!beats(rev, state.revs[fieldKey(key, f)])) continue;
        prev[f] = r[f];
      }
      return Object.keys(prev).length ? [{ t: "request.update", id: op.id, patch: prev as RequestPatch }] : [];
    }
    case "request.remove": {
      const r = state.requests[op.id];
      if (!r || isStale(state, requestKey(op.id), rev)) return [];
      return [{ t: "request.add", request: r }];
    }
    case "roster.upsert":
    case "roster.update":
    case "roster.remove":
    case "settings.update":
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// mergeStates

type EntityKind = "node" | "request" | "roster";

function splitKey(key: string): { entity: string; field: string | null } {
  if (key.startsWith("roster:")) {
    const rest = key.slice(7);
    const i = rest.indexOf(":");
    return i < 0 ? { entity: key, field: null } : { entity: "roster:" + rest.slice(0, i), field: rest.slice(i + 1) };
  }
  const i = key.indexOf(":");
  return i < 0 ? { entity: key, field: null } : { entity: key.slice(0, i), field: key.slice(i + 1) };
}

function fieldRevsOf(state: RoomState): Map<string, Map<string, Rev>> {
  const out = new Map<string, Map<string, Rev>>();
  for (const key of Object.keys(state.revs)) {
    if (key.startsWith("settings:")) continue;
    const { entity, field } = splitKey(key);
    if (field === null) continue;
    let m = out.get(entity);
    if (!m) {
      m = new Map();
      out.set(entity, m);
    }
    m.set(field, state.revs[key]);
  }
  return out;
}

function entityOf(state: RoomState, key: string): { kind: EntityKind; obj: object } | null {
  if (key.startsWith("roster:")) {
    const m = state.roster[key.slice(7)];
    return m ? { kind: "roster", obj: m } : null;
  }
  const n = state.nodes[key];
  if (n) return { kind: "node", obj: n };
  const r = state.requests[key];
  if (r) return { kind: "request", obj: r };
  return null;
}

const ZERO_REV: Rev = { seq: 0, actor: "" as ClientId };

/** Commutative, associative, idempotent entity-wise merge (§3.4). */
export function mergeStates(a: RoomState, b: RoomState): RoomState {
  const keys = new Set<string>();
  const collect = (s: RoomState) => {
    for (const id of Object.keys(s.nodes)) keys.add(nodeKey(id));
    for (const id of Object.keys(s.requests)) keys.add(requestKey(id));
    for (const id of Object.keys(s.roster)) keys.add(rosterKey(id));
    for (const k of Object.keys(s.tombstones)) keys.add(k);
  };
  collect(a);
  collect(b);
  const fieldsA = fieldRevsOf(a);
  const fieldsB = fieldRevsOf(b);

  const nodes: Record<string, MapNode> = {};
  const requests: Record<string, SupplyRequest> = {};
  const roster: Record<string, RosterMember> = {};
  const revs: Record<string, Rev> = {};
  const tombstones: Record<string, Rev> = {};

  for (const key of keys) {
    const ea = entityOf(a, key);
    const eb = entityOf(b, key);
    const ra = ea ? (a.revs[key] ?? ZERO_REV) : undefined;
    const rb = eb ? (b.revs[key] ?? ZERO_REV) : undefined;
    const ta = a.tombstones[key];
    const tb = b.tombstones[key];

    // The highest of the four decides. Entity ties (same add op on both sides) prefer `a`;
    // the values are the same generation, so the choice does not show in the result.
    const candidates: { rev: Rev | undefined; kind: "a" | "b" | "tomb" }[] = [
      { rev: ra, kind: "a" },
      { rev: rb, kind: "b" },
      { rev: ta, kind: "tomb" },
      { rev: tb, kind: "tomb" },
    ];
    let top: { rev: Rev; kind: "a" | "b" | "tomb" } | null = null;
    for (const c of candidates) {
      if (c.rev === undefined) continue;
      if (top === null || compareRev(c.rev, top.rev) > 0) top = { rev: c.rev, kind: c.kind };
    }
    if (top === null) continue;
    if (top.kind === "tomb") {
      tombstones[key] = top.rev;
      continue;
    }
    const winnerState = top.kind === "a" ? a : b;
    const winner = (top.kind === "a" ? ea : eb) as { kind: EntityKind; obj: object };
    const W = top.rev;
    const obj: Record<string, unknown> = { ...(winner.obj as Record<string, unknown>) };
    revs[key] = W;

    // Field revs greater than the winning entity rev survive; the higher rev supplies the value.
    const merged = new Map<string, { rev: Rev; from: RoomState }>();
    const fa = fieldsA.get(key);
    if (fa) for (const [f, r] of fa) if (compareRev(r, W) > 0) merged.set(f, { rev: r, from: a });
    const fb = fieldsB.get(key);
    if (fb)
      for (const [f, r] of fb) {
        if (compareRev(r, W) <= 0) continue;
        const cur = merged.get(f);
        if (!cur || compareRev(r, cur.rev) > 0) merged.set(f, { rev: r, from: b });
      }
    for (const [f, { rev, from }] of merged) {
      const src = (from === winnerState ? winner : entityOf(from, key))?.obj as
        | Record<string, unknown>
        | undefined;
      if (!src || !Object.prototype.hasOwnProperty.call(src, f)) continue;
      obj[f] = src[f];
      revs[fieldKey(key, f)] = rev;
    }
    if (winner.kind === "node") nodes[key] = obj as unknown as MapNode;
    else if (winner.kind === "request") requests[key] = obj as unknown as SupplyRequest;
    else roster[key.slice(7)] = obj as unknown as RosterMember;
  }

  // Settings: per field by rev; createRoomState stamps every field, so independent states never tie.
  const settings = { ...a.settings } as RoomSettings;
  for (const f of SETTINGS_FIELDS) {
    const k = settingKey(f);
    const ra = a.revs[k];
    const rb = b.revs[k];
    if (rb !== undefined && (ra === undefined || compareRev(rb, ra) > 0)) {
      (settings as unknown as Record<string, unknown>)[f] = b.settings[f];
      revs[k] = rb;
    } else if (ra !== undefined) {
      revs[k] = ra;
    }
  }

  const merged: RoomState = {
    v: 1,
    code: a.code,
    createdAt: Math.min(a.createdAt, b.createdAt),
    settings,
    nodes,
    order: [],
    requests,
    roster,
    revs,
    tombstones,
    seq: Math.max(a.seq, b.seq),
  };
  const d = draftOf(merged);
  enforceNodeCap(d);
  const result = finish(d, merged.seq);
  return { ...result, order: canonicalOrder(result.nodes) };
}
