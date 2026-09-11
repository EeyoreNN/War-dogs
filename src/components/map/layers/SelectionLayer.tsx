// Selection handles (§4.3.3): a dashed world box for the selected node plus screen-constant
// handles for shape endpoints and the danger radius. Never exported.
import { MAP_PX, type MapNode } from "@/lib/map/types";
import { nodeBounds, nodeHandles } from "../lib/hit";
import { TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";

export function SelectionLayer({ node }: { node: MapNode | null }) {
  if (!node) return null;
  const b = nodeBounds(node);
  const pad = 0.004;
  const handles = nodeHandles(node);
  return (
    <g data-layer-group="selection" data-export="skip">
      {node.t !== "marker" ? (
        <rect
          x={((b.x0 - pad) * MAP_PX).toFixed(1)}
          y={((b.y0 - pad) * MAP_PX).toFixed(1)}
          width={((b.x1 - b.x0 + pad * 2) * MAP_PX).toFixed(1)}
          height={((b.y1 - b.y0 + pad * 2) * MAP_PX).toFixed(1)}
          fill="none"
          stroke={TOKEN_HEX.accent}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}
      {handles.map((h) => (
        <g key={h.id} data-screen="" style={{ transform: screenTransform(h.at) }}>
          <circle
            cx={0}
            cy={0}
            r={12}
            fill="rgba(0,0,0,0)"
            data-handle={h.id}
            style={{ cursor: "grab" }}
          />
          <circle
            cx={0}
            cy={0}
            r={6}
            fill={TOKEN_HEX.accent}
            stroke={TOKEN_HEX.bg0}
            strokeWidth={2}
            pointerEvents="none"
          />
        </g>
      ))}
    </g>
  );
}
