// Human descriptions of map entities for the NodeList, tooltips and the live region (§4.3.10).
import { gridRef } from "@/lib/map/grid";
import { formatDistance } from "./format";
import { MARKER_META, REQUEST_KIND_LABEL, type MapNode, type SupplyRequest } from "@/lib/map/types";
import { distance } from "@/lib/geo";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Short type name: `Friendly LZ`, `Enemy FOB · Valkyra`, `Danger`, `Pen stroke`, `Arrow`… */
export function nodeKindLabel(n: MapNode): string {
  switch (n.t) {
    case "marker": {
      const meta = MARKER_META[n.kind];
      if (meta.group === "friendly") return `Friendly ${meta.short}`;
      if (meta.group === "enemy") return `Enemy ${meta.short}${n.team ? ` · ${n.team}` : ""}`;
      return capital(meta.label);
    }
    case "stroke":
      return "Pen stroke";
    case "shape":
      return capital(n.shape);
    case "text":
      return "Text";
    case "measure":
      return "Measurement";
  }
}

/** Anchor point used for grid references and "centre on". */
export function nodeAnchor(n: MapNode): { x: number; y: number } {
  switch (n.t) {
    case "marker":
    case "text":
      return n.at;
    case "shape":
    case "measure":
      return { x: (n.a.x + n.b.x) / 2, y: (n.a.y + n.b.y) / 2 };
    case "stroke": {
      const p = n.points[Math.floor(n.points.length / 2)] ?? n.points[0];
      return p;
    }
  }
}

/**
 * `Friendly LZ "LZ BRAVO" at D7, placed by Boston` / `Enemy FOB · Valkyra "AUSTIN" at F3, placed
 * by Rook` / `Arrow from C6 to E5, drawn by Ossian`.
 */
export function describeNode(n: MapNode, widthMetres: number | null = null): string {
  const kind = nodeKindLabel(n);
  switch (n.t) {
    case "marker":
      return `${kind} "${n.label || MARKER_META[n.kind].short}" at ${gridRef(n.at)}, placed by ${n.authorName}`;
    case "text":
      return `${kind} "${n.text.replace(/\s+/g, " ")}" at ${gridRef(n.at)}, by ${n.authorName}`;
    case "shape":
      return `${kind} from ${gridRef(n.a)} to ${gridRef(n.b)}, drawn by ${n.authorName}`;
    case "measure":
      return `${kind} ${gridRef(n.a)} to ${gridRef(n.b)}, ${formatDistance(distance(n.a, n.b), widthMetres)}, by ${n.authorName}`;
    case "stroke":
      return `${kind} near ${gridRef(nodeAnchor(n))}, ${n.color} ink, by ${n.authorName}`;
  }
}

/** `Fuel · open · by Boston at D7` for tooltips and the request pin title. */
export function describeRequest(r: SupplyRequest): string {
  const parts = [
    REQUEST_KIND_LABEL[r.kind],
    r.status,
    `by ${r.byName}${r.at ? ` at ${gridRef(r.at)}` : ""}`,
  ];
  if (r.priority === "urgent") parts.push("urgent");
  return parts.join(" · ");
}

/** Whether a node can be renamed / edited inline (markers and text). */
export const isEditable = (n: MapNode): n is Extract<MapNode, { t: "marker" | "text" }> =>
  n.t === "marker" || n.t === "text";
