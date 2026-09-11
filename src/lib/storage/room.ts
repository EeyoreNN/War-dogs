// `wardogs:room:<CODE>` snapshots (§5.4): compaction, size cap, quarantine of unparsable JSON.
import { canonicalOrder, compareRev } from "../map/reduce";
import { parseSnapshot } from "../map/schema";
import {
  MAX_NODES,
  MAX_STATE_BYTES,
  MAX_TOMBSTONES,
  type RoomSnapshot,
  type RoomState,
} from "../map/types";
import { roomBadKey, roomKey } from "./keys";
import { readLocal, removeLocal, storageFailure, writeLocal } from "./local";

export type LoadStatus = "ok" | "missing" | "corrupt";

/** Keeps the newest MAX_TOMBSTONES tombstones by rev and caps nodes at MAX_NODES (oldest strokes go). */
export function compactState(state: RoomState): RoomState {
  let next = state;
  const tombKeys = Object.keys(state.tombstones);
  if (tombKeys.length > MAX_TOMBSTONES) {
    const keep = tombKeys
      .sort((a, b) => compareRev(state.tombstones[b], state.tombstones[a]))
      .slice(0, MAX_TOMBSTONES);
    const tombstones: RoomState["tombstones"] = {};
    for (const k of keep) tombstones[k] = state.tombstones[k];
    next = { ...next, tombstones };
  }
  const ids = Object.keys(next.nodes);
  if (ids.length > MAX_NODES) next = dropOldestStrokes(next, ids.length - MAX_NODES);
  return next;
}

/** Remove the `count` oldest strokes (canonical order) with their revs; no tombstones. */
export function dropOldestStrokes(state: RoomState, count: number): RoomState {
  if (count <= 0) return state;
  const nodes = { ...state.nodes };
  const revs = { ...state.revs };
  let dropped = 0;
  for (const id of canonicalOrder(state.nodes)) {
    if (dropped >= count) break;
    if (nodes[id].t !== "stroke") continue;
    delete nodes[id];
    delete revs[id];
    for (const k of Object.keys(revs)) if (k.startsWith(id + ":")) delete revs[k];
    dropped++;
  }
  if (dropped === 0) return state;
  return { ...state, nodes, revs, order: canonicalOrder(nodes) };
}

export interface SaveResult {
  ok: boolean;
  /** Strokes dropped to fit MAX_STATE_BYTES. */
  trimmed: number;
  failure: "quota" | "unavailable" | "error" | null;
  bytes: number;
}

/** Compacts, trims to MAX_STATE_BYTES (oldest strokes first) and writes. Never throws. */
export function saveRoom(code: string, snapshot: RoomSnapshot): SaveResult {
  let state = compactState(snapshot.state);
  let json = JSON.stringify({ ...snapshot, state });
  let trimmed = 0;
  while (json.length > MAX_STATE_BYTES) {
    const strokes = Object.values(state.nodes).filter((n) => n.t === "stroke").length;
    if (strokes === 0) break;
    const step = Math.max(1, Math.ceil(strokes * 0.1));
    state = dropOldestStrokes(state, step);
    trimmed += step;
    json = JSON.stringify({ ...snapshot, state });
  }
  const ok = writeLocal(roomKey(code), json);
  return { ok, trimmed, failure: ok ? null : (storageFailure() ?? "error"), bytes: json.length };
}

/** Parse the stored snapshot; unparsable JSON is quarantined to `<key>:bad` and reported as corrupt. */
export function loadRoomResult(code: string): {
  snapshot: RoomSnapshot | null;
  status: LoadStatus;
} {
  const raw = readLocal(roomKey(code));
  if (raw === null) return { snapshot: null, status: "missing" };
  let json: unknown = null;
  let snapshot: RoomSnapshot | null = null;
  try {
    json = JSON.parse(raw);
    snapshot = parseSnapshot(json);
  } catch {
    snapshot = null;
  }
  if (snapshot && snapshot.state.code === code) return { snapshot, status: "ok" };
  writeLocal(roomBadKey(code), raw);
  removeLocal(roomKey(code));
  return { snapshot: null, status: "corrupt" };
}

export function loadRoom(code: string): RoomSnapshot | null {
  return loadRoomResult(code).snapshot;
}

/** The quarantined raw string, if any. */
export function loadQuarantined(code: string): string | null {
  return readLocal(roomBadKey(code));
}
