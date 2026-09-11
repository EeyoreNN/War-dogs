// The UI's verbs (§4.3): every mutation goes through `useRoomStore` actions with the pure
// lifecycle helpers from the engine; each returns the op (or null when refused / unchanged).
import { announce } from "@/components/ui/live-region";
import { toast } from "@/components/ui/toast";
import { clamp01 } from "@/lib/geo";
import { gridRef } from "@/lib/map/grid";
import { newId } from "@/lib/map/ids";
import { importPlan } from "@/lib/map/plan";
import {
  claim,
  createRequest,
  deliver,
  release,
  REQUEST_ERROR_TEXT,
  setEta,
} from "@/lib/map/requests";
import { editableLayer, isCommand } from "@/lib/map/roster";
import { markerAt } from "@/lib/map/tools";
import {
  MAX_TEXT_CHARS,
  REQUEST_KIND_LABEL,
  asClientId,
  type LayerId,
  type MapNode,
  type MarkerKind,
  type NodePatch,
  type NodeType,
  type Op,
  type OpBody,
  type Point,
  type RequestKind,
  type RequestPriority,
  type RoomSettings,
  type RoomSnapshot,
  type RosterPatch,
} from "@/lib/map/types";
import { now, useRoomStore } from "@/store/room";
import { COPY } from "@/store/notify";
import { movePatch } from "./lib/hit";
import { useUiStore } from "./ui-store";

const store = () => useRoomStore.getState();

function me() {
  const s = store();
  return s.state && s.me ? (s.state.roster[s.me.client] ?? null) : null;
}

export function myLayer(): LayerId {
  const s = store();
  return s.state ? editableLayer(s.state.settings, me()) : "team";
}

// ---------------------------------------------------------------------------------------------
// Nodes

export function addNodes(nodes: MapNode[]): Op | null {
  const op = store().dispatch({ t: "node.add", nodes });
  if (op) useUiStore.getState().markFresh(nodes.map((n) => n.id));
  return op;
}

export function placeMarker(at: Point, kind?: MarkerKind): Op | null {
  const s = store();
  if (!s.state || !s.me) return null;
  const node = markerAt(
    {
      tool: "marker",
      ink: s.ink,
      markerKind: kind ?? s.markerKind,
      enemyTeam: s.enemyTeam,
      layer: myLayer(),
      author: s.me.client,
      authorName: s.me.callsign,
      widthMetres: null,
      now,
      id: newId,
    },
    at,
  );
  const op = addNodes([node]);
  if (op) {
    s.select(node.id);
    announce(`${node.label} placed at ${gridRef(node.at)}`);
  }
  return op;
}

export function addText(at: Point, text: string): Op | null {
  const s = store();
  if (!s.state || !s.me) return null;
  const clean = text.trim().slice(0, MAX_TEXT_CHARS);
  if (!clean) return null;
  return addNodes([
    {
      id: newId(),
      t: "text",
      layer: myLayer(),
      author: s.me.client,
      authorName: s.me.callsign,
      createdAt: now(),
      at: { x: clamp01(at.x), y: clamp01(at.y) },
      text: clean,
      color: s.ink,
      size: "md",
    },
  ]);
}

export function updateNode(id: string, patch: NodePatch): Op | null {
  return store().dispatch({ t: "node.update", id, patch });
}

export function renameNode(id: string, value: string): Op | null {
  const n = store().state?.nodes[id];
  if (!n) return null;
  if (n.t === "marker") return updateNode(id, { label: value.slice(0, 32) });
  if (n.t === "text") return value.trim() ? updateNode(id, { text: value }) : removeNodes([id]);
  return null;
}

export function removeNodes(ids: string[]): Op | null {
  const s = store();
  if (!ids.length) return null;
  const op = s.dispatch({ t: "node.remove", ids });
  if (op && s.selection && ids.includes(s.selection)) s.select(null);
  return op;
}

export function nudgeNode(id: string, dx: number, dy: number): Op | null {
  const n = store().state?.nodes[id];
  if (!n) return null;
  return updateNode(id, movePatch(n, dx, dy));
}

export function clearLayer(layer: LayerId, types: NodeType[] | null): Op | null {
  return store().dispatch({ t: "layer.clear", layer, types });
}

// ---------------------------------------------------------------------------------------------
// Requests

export function addRequest(
  kind: RequestKind,
  priority: RequestPriority,
  note: string,
  at: Point | null,
): Op | null {
  const s = store();
  if (!s.state || !s.me) return null;
  const request = createRequest({
    id: newId(),
    kind,
    priority,
    by: s.me.client,
    byName: s.me.callsign,
    at: at ? { x: clamp01(at.x), y: clamp01(at.y) } : null,
    note: note.trim().slice(0, 60),
    layer: myLayer(),
    now: now(),
  });
  const op = s.dispatch({ t: "request.add", request });
  if (op) s.highlight(request.id);
  return op;
}

function requestTransition(
  id: string,
  fn: (
    r: NonNullable<ReturnType<typeof requestById>>,
    m: NonNullable<ReturnType<typeof me>>,
  ) => ReturnType<typeof claim>,
): Op | null {
  const r = requestById(id);
  const m = me();
  if (!r || !m) return null;
  const patch = fn(r, m);
  if (typeof patch === "string") {
    toast(REQUEST_ERROR_TEXT[patch], { tone: "warn" });
    return null;
  }
  return store().dispatch({ t: "request.update", id, patch });
}

const requestById = (id: string) => store().state?.requests[id] ?? null;

export const claimRequest = (id: string, etaSec: number | null = null) =>
  requestTransition(id, (r, m) => claim(r, m, now(), etaSec));
export const deliverRequest = (id: string) => requestTransition(id, (r, m) => deliver(r, m, now()));
export const releaseRequest = (id: string) => requestTransition(id, (r, m) => release(r, m));
export const setRequestEta = (id: string, etaSec: number | null) =>
  requestTransition(id, (r, m) => setEta(r, m, etaSec));

export function editRequest(
  id: string,
  patch: { kind?: RequestKind; priority?: RequestPriority; note?: string },
): Op | null {
  return store().dispatch({ t: "request.update", id, patch });
}

export function removeRequest(id: string): Op | null {
  const s = store();
  const op = s.dispatch({ t: "request.remove", id });
  if (op && s.highlightId === id) s.highlight(null);
  return op;
}

// ---------------------------------------------------------------------------------------------
// Roster and access

export function askToDraw(): void {
  const s = store();
  if (!s.me) return;
  const op = s.dispatch(
    { t: "roster.update", id: s.me.client, patch: { drawRequested: true } },
    { undoable: false },
  );
  if (op) toast(COPY.askedToDraw);
}

export function updateMember(id: string, patch: RosterPatch): Op | null {
  return store().dispatch({ t: "roster.update", id: asClientId(id), patch }, { undoable: false });
}

export const approveDraw = (id: string) =>
  updateMember(id, { canDraw: true, drawRequested: false });
export const denyDraw = (id: string) => updateMember(id, { drawRequested: false });
export const revokeDraw = (id: string) =>
  updateMember(id, { canDraw: false, drawRequested: false });
export const setCoCommander = (id: string, on: boolean) =>
  updateMember(id, { role: on ? "co-commander" : "member" });

/** Commander only: promote `id`, demote self, in one history-free batch. */
export function handOffCommand(id: string): Op[] {
  const s = store();
  if (!s.me || me()?.role !== "commander") return [];
  return s.dispatchMany(
    [
      { t: "roster.update", id: asClientId(id), patch: { role: "commander" } },
      { t: "roster.update", id: s.me.client, patch: { role: "member" } },
    ],
    { undoable: false },
  );
}

export function kickMember(id: string): Op | null {
  return store().dispatch({ t: "roster.remove", id: asClientId(id) }, { undoable: false });
}

export function updateSettings(patch: Partial<RoomSettings>): Op | null {
  return store().dispatch({ t: "settings.update", patch }, { undoable: false });
}

export function canManage(): boolean {
  return isCommand(me());
}

/** Load plan (§4.3.6): replace or merge, batched, one history entry. */
export function loadPlan(snapshot: RoomSnapshot, mode: "replace" | "merge"): Op[] {
  const s = store();
  if (!s.state || !s.me) return [];
  const bodies: OpBody[] = importPlan(s.state, snapshot, mode, s.me.client, now());
  const ops = s.dispatchMany(bodies);
  const added = bodies.flatMap((b) => (b.t === "node.add" ? b.nodes.map((n) => n.id) : []));
  useUiStore.getState().markFresh(added);
  return ops;
}

/** Announcement text for a request's kind. */
export const kindLabel = (kind: RequestKind) => REQUEST_KIND_LABEL[kind];
