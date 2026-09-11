// Single-writer housekeeping (§5.5): the ops every client could compute, emitted by one.
import { nodesOverCap } from "@/lib/map/reduce";
import { shouldPrune } from "@/lib/map/requests";
import { isOnline, staleMembers, successor } from "@/lib/map/roster";
import { MAX_NODES_PER_OP, type OpBody, type Presence, type RoomState } from "@/lib/map/types";

export const DRAW_REQUEST_TTL_MS = 10 * 60_000;

export interface HousekeepingInput {
  state: RoomState;
  presence: Record<string, Presence>;
  now: number;
  /** When this client first saw each member's `drawRequested` flag. */
  drawRequestedAt: Record<string, number>;
}

export function housekeepingOps({
  state,
  presence,
  now,
  drawRequestedAt,
}: HousekeepingInput): OpBody[] {
  const ops: OpBody[] = [];
  for (const r of Object.values(state.requests))
    if (shouldPrune(r, now)) ops.push({ t: "request.remove", id: r.id });
  const over = nodesOverCap(state.nodes);
  for (let i = 0; i < over.length; i += MAX_NODES_PER_OP)
    ops.push({ t: "node.remove", ids: over.slice(i, i + MAX_NODES_PER_OP) });
  const roster = Object.values(state.roster);
  const commander = roster.find((m) => m.role === "commander");
  if (commander && !isOnline(commander, presence[commander.id], now)) {
    const next = successor(roster, presence, now, commander.id);
    if (next) {
      ops.push({ t: "roster.update", id: next.id, patch: { role: "commander" } });
      ops.push({ t: "roster.update", id: commander.id, patch: { role: "member" } });
    }
  }
  for (const m of roster) {
    const since = drawRequestedAt[m.id];
    if (m.drawRequested && since !== undefined && now - since >= DRAW_REQUEST_TTL_MS) {
      ops.push({ t: "roster.update", id: m.id, patch: { drawRequested: false } });
    }
  }
  for (const m of staleMembers(roster, presence, now))
    ops.push({ t: "roster.update", id: m.id, patch: { online: false } });
  return ops;
}
