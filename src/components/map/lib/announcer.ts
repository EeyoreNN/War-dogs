// Live-region announcements derived from state diffs (§4.3.4, §4.3.10): request lifecycle,
// marker placements by others and roster joins. Pure; the hook in MapApp feeds it.
import { gridRef } from "@/lib/map/grid";
import { spokenEta } from "./format";
import { MARKER_META, REQUEST_KIND_LABEL, type ClientId, type RoomState } from "@/lib/map/types";

/** Above this many changes in one diff the announcement collapses to a count. */
export const ANNOUNCE_CAP = 4;

export function diffAnnouncements(
  prev: RoomState | null,
  next: RoomState | null,
  me: ClientId | null,
): string[] {
  if (!prev || !next || prev === next) return [];
  const out: string[] = [];

  if (prev.requests !== next.requests) {
    for (const r of Object.values(next.requests)) {
      const before = prev.requests[r.id];
      const kind = REQUEST_KIND_LABEL[r.kind];
      if (!before) {
        if (r.status === "open")
          out.push(`${kind} requested by ${r.byName}${r.at ? ` at ${gridRef(r.at)}` : ""}`);
        continue;
      }
      if (before.status === r.status) continue;
      if (r.status === "claimed")
        out.push(
          `${kind} claimed by ${r.claimedByName ?? "someone"}${r.etaSec !== null ? `, ETA ${spokenEta(r.etaSec)}` : ""}`,
        );
      else if (r.status === "delivered") out.push(`${kind} delivered`);
      else if (r.status === "open" && before.status === "claimed") out.push(`${kind} released`);
    }
  }

  if (prev.nodes !== next.nodes) {
    for (const id of next.order) {
      if (prev.nodes[id]) continue;
      const n = next.nodes[id];
      if (n.t !== "marker" || n.author === me) continue;
      const meta = MARKER_META[n.kind];
      const what = meta.group === "enemy" ? `Enemy ${meta.short.toLowerCase()}` : meta.label;
      out.push(`${n.authorName} placed ${what} at ${gridRef(n.at)}`);
    }
  }

  if (prev.roster !== next.roster) {
    for (const m of Object.values(next.roster)) {
      if (m.id === me || prev.roster[m.id]) continue;
      out.push(`${m.callsign} joined`);
    }
  }

  if (out.length > ANNOUNCE_CAP) return [`${out.length} changes on the map`];
  return out;
}
