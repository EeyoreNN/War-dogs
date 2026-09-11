// Text labels: world-scaled Barlow text with a dark halo (§4.3.2).
import * as React from "react";
import { MAP_PX, type TextLabel } from "@/lib/map/types";
import { inkHex, TEXT_SIZE_PX, TOKEN_HEX } from "../lib/palette";

export const TEXT_FONT = "Barlow, system-ui, -apple-system, Segoe UI, sans-serif";

export const TextNode = React.memo(function TextNode({
  node,
  dim,
  hidden,
}: {
  node: TextLabel;
  dim?: boolean;
  /** Being edited inline: the editor replaces it. */
  hidden?: boolean;
}) {
  const size = TEXT_SIZE_PX[node.size];
  const lines = node.text.split("\n");
  const x = node.at.x * MAP_PX;
  const y = node.at.y * MAP_PX;
  return (
    <g
      data-node-id={node.id}
      data-node-type="text"
      data-layer={node.layer}
      opacity={hidden ? 0 : dim ? 0.6 : undefined}
    >
      <text
        x={x.toFixed(1)}
        y={y.toFixed(1)}
        fontFamily={TEXT_FONT}
        fontSize={size}
        fontWeight={600}
        fill={inkHex(node.color)}
        stroke={TOKEN_HEX.bg0}
        strokeWidth={size * 0.16}
        strokeLinejoin="round"
        paintOrder="stroke"
        letterSpacing="0.01em"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x.toFixed(1)} dy={i === 0 ? 0 : size * 1.15}>
            {line || " "}
          </tspan>
        ))}
      </text>
    </g>
  );
});

export function TextLayer({
  nodes,
  dimLayers,
  editingId,
}: {
  nodes: TextLabel[];
  dimLayers?: ReadonlySet<string>;
  editingId?: string | null;
}) {
  return (
    <g data-layer-group="text">
      {nodes.map((n) => (
        <TextNode key={n.id} node={n} dim={dimLayers?.has(n.layer)} hidden={editingId === n.id} />
      ))}
    </g>
  );
}
