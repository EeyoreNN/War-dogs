// Freehand ink (§4.3.2): world-scaled perfect-freehand outlines with presentation attributes.
import * as React from "react";
import { outlineToPath, strokeOutline } from "@/lib/map/ink";
import { MAP_PX, type Stroke } from "@/lib/map/types";
import { inkHex } from "../lib/palette";

/** Outline path in world px for a stroke (points are map fractions). */
export function strokePathD(points: { x: number; y: number }[], widthFraction: number): string {
  const pts = points.map((p) => ({ x: p.x * MAP_PX, y: p.y * MAP_PX }));
  return outlineToPath(strokeOutline(pts, widthFraction * MAP_PX));
}

export const StrokePath = React.memo(function StrokePath({
  node,
  dim,
  fresh,
}: {
  node: Stroke;
  dim?: boolean;
  /** Just committed or arrived: reveal via the `ink` motion (§2.4). */
  fresh?: boolean;
}) {
  const d = React.useMemo(() => strokePathD(node.points, node.width), [node.points, node.width]);
  return (
    <g
      data-node-id={node.id}
      data-node-type="stroke"
      data-layer={node.layer}
      opacity={dim ? 0.6 : undefined}
      style={fresh ? { animation: "wd-ink-in 120ms cubic-bezier(0.2,0.7,0.2,1) both" } : undefined}
    >
      <path d={d} fill={inkHex(node.color)} fillRule="nonzero" />
    </g>
  );
});

export function StrokeLayer({
  nodes,
  dimLayers,
  freshIds,
}: {
  nodes: Stroke[];
  dimLayers?: ReadonlySet<string>;
  freshIds?: ReadonlySet<string>;
}) {
  return (
    <g data-layer-group="strokes">
      {nodes.map((n) => (
        <StrokePath key={n.id} node={n} dim={dimLayers?.has(n.layer)} fresh={freshIds?.has(n.id)} />
      ))}
    </g>
  );
}
