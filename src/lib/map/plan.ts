// Plan export / import (§3.4): Markdown for Discord, snapshots, and import as ops.
import { mapById } from "@/config/maps";
import { CONTROL_ZONE_LABEL } from "../terrain/types";
import { distance } from "../geo";
import { gridRef } from "./grid";
import { newId } from "./ids";
import { canonicalOrder } from "./reduce";
import {
  MARKER_META,
  MAX_NODES_PER_OP,
  REQUEST_KIND_LABEL,
  type ClientId,
  type LayerId,
  type MapNode,
  type Marker,
  type OpBody,
  type RoomSnapshot,
  type RoomState,
  type SupplyRequest,
} from "./types";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `2026-09-11 14:32 UTC` — explicit zone so a pasted plan reads the same for every squad. */
export function formatPlanDate(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

/** "2 min" / "45 s" / "1 h 05 min" for request ages. */
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${pad2(m % 60)} min`;
}

function metresText(m: number): string {
  return `${Math.round(m).toLocaleString("en-US")} m`;
}

function markerLine(n: Marker): string {
  const meta = MARKER_META[n.kind];
  const label = n.label ? `"${n.label}"` : `"${meta.short}"`;
  const faction = n.team ? ` · ${n.team.toUpperCase()}` : "";
  const radius =
    n.kind === "danger" && n.radius !== null ? ` (r ${(n.radius * 100).toFixed(1)} % of map)` : "";
  return `• ${meta.short} ${label}${faction} at ${gridRef(n.at)}${radius}`;
}

function requestLine(r: SupplyRequest, now: number): string {
  const parts = [`${REQUEST_KIND_LABEL[r.kind]}${r.priority === "urgent" ? " (URGENT)" : ""}`];
  parts.push(`by ${r.byName}`);
  if (r.at) parts.push(`at ${gridRef(r.at)}`);
  if (r.status === "claimed" && r.claimedByName) {
    parts.push(`claimed by ${r.claimedByName}${r.etaSec !== null ? ` (ETA ${r.etaSec} s)` : ""}`);
  }
  parts.push(`open ${formatAge(now - r.createdAt)}`);
  if (r.note) parts.push(`— ${r.note}`);
  return `• ${parts.join(" · ")}`;
}

/** Markdown for Discord: header, FRIENDLY / ENEMY / MARKS lists with grid refs, NOTES, OPEN REQUESTS. */
export function planToText(state: RoomState, mapName: string, now: number): string {
  const s = state.settings;
  const zone = CONTROL_ZONE_LABEL[s.controlZone];
  const widthMetres = s.mapSource.kind === "builtin" ? (mapById(s.map)?.widthMetres ?? null) : null;
  const lines: string[] = [];
  lines.push(
    `**WAR ROOM ${state.code} · ${s.team.toUpperCase()} · ${mapName.toUpperCase()} · ${zone.toUpperCase()} ZONE** — ${formatPlanDate(now)}`,
  );

  const nodes = canonicalOrder(state.nodes).map((id) => state.nodes[id]);
  const markers = nodes.filter((n): n is Marker => n.t === "marker");
  const friendly = markers.filter((m) => MARKER_META[m.kind].group === "friendly");
  const enemy = markers.filter((m) => MARKER_META[m.kind].group === "enemy");
  const marks = markers.filter((m) => MARKER_META[m.kind].group === "mark");
  const texts = nodes.filter((n) => n.t === "text");
  const measures = nodes.filter((n) => n.t === "measure");

  const section = (title: string, items: string[]) => {
    lines.push("", `__${title}__`);
    if (items.length === 0) lines.push("• none");
    else lines.push(...items);
  };
  section("FRIENDLY", friendly.map(markerLine));
  section("ENEMY", enemy.map(markerLine));
  section("MARKS", marks.map(markerLine));
  if (texts.length || measures.length) {
    section("NOTES", [
      ...texts.map((t) => `• "${t.text.replace(/\n/g, " / ")}" at ${gridRef(t.at)}`),
      ...measures.map((m) => {
        const d = distance(m.a, m.b);
        const len = widthMetres === null ? `${d.toFixed(2)} map` : metresText(d * widthMetres);
        return `• Measure ${gridRef(m.a)} → ${gridRef(m.b)}: ${len}`;
      }),
    ]);
  }
  const open = Object.values(state.requests)
    .filter((r) => r.status !== "delivered")
    .sort((a, b) => a.createdAt - b.createdAt);
  section(
    "OPEN REQUESTS",
    open.map((r) => requestLine(r, now)),
  );

  const strokes = nodes.filter((n) => n.t === "stroke").length;
  const shapes = nodes.filter((n) => n.t === "shape").length;
  lines.push(
    "",
    `Ink: ${strokes} stroke${strokes === 1 ? "" : "s"}, ${shapes} shape${shapes === 1 ? "" : "s"} · wardogs.tech`,
  );
  return lines.join("\n");
}

export function planToSnapshot(state: RoomState, now: number): RoomSnapshot {
  return { v: 1, state, savedAt: now };
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/** Layers that currently hold nodes, `team` first. */
export function layersOf(state: RoomState): LayerId[] {
  const seen = new Set<LayerId>(["team"]);
  for (const id of state.order) seen.add(state.nodes[id].layer);
  return [...seen];
}

/**
 * replace = layer.clear of every layer + node.add batches; merge = node.add batches of the
 * incoming nodes that are not already present. Ids that collide with a live node (merge keeps
 * the live one) or with a tombstone are re-minted so the reducer does not treat them as stale.
 * Every batch ≤ MAX_NODES_PER_OP.
 */
export function importPlan(
  target: RoomState,
  incoming: RoomSnapshot,
  mode: "replace" | "merge",
  actor: ClientId,
  now: number,
): OpBody[] {
  void actor;
  const ops: OpBody[] = [];
  if (mode === "replace") {
    for (const layer of layersOf(target)) ops.push({ t: "layer.clear", layer, types: null });
  }
  const source = incoming.state;
  const nodes: MapNode[] = [];
  for (const id of canonicalOrder(source.nodes)) {
    const n = source.nodes[id];
    const live = target.nodes[id] !== undefined;
    const dead = target.tombstones[id] !== undefined;
    if (mode === "merge" && live) continue;
    if (live || dead) nodes.push({ ...n, id: newId(), createdAt: now });
    else nodes.push(n);
  }
  for (const batch of chunk(nodes, MAX_NODES_PER_OP)) ops.push({ t: "node.add", nodes: batch });
  return ops;
}
