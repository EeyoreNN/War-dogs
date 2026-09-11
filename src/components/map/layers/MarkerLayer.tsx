// Markers and request pins (§4.3.2, Appendix B): 32 px screen-constant glyphs with a mono label
// under them; the danger radius disc is world-scaled. Every look is a presentation attribute.
import * as React from "react";
import { MAP_PX, MARKER_META, type Marker, type SupplyRequest, type Team } from "@/lib/map/types";
import { describeRequest } from "../lib/describe";
import { markerHex, MARKER_PX, requestHex, TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";
import { REQUEST_SYMBOL_ID, symbolId } from "../MarkerSprite";

const LABEL_FONT = "JetBrains Mono, ui-monospace, Menlo, monospace";
const HALF = MARKER_PX / 2;

export function markerLabelText(m: Marker): string {
  const base = (m.label || MARKER_META[m.kind].short).toUpperCase();
  return m.team ? `${base} · ${m.team.toUpperCase()}` : base;
}

export function MarkerLabel({ text, y, color }: { text: string; y: number; color?: string }) {
  return (
    <text
      x={0}
      y={y}
      textAnchor="middle"
      fontFamily={LABEL_FONT}
      fontSize={10}
      fontWeight={700}
      letterSpacing="0.08em"
      fill={color ?? TOKEN_HEX.text0}
      stroke={TOKEN_HEX.bg0}
      strokeWidth={3}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

export const MarkerNode = React.memo(function MarkerNode({
  node,
  roomTeam,
  dim,
  fresh,
  selected,
}: {
  node: Marker;
  roomTeam: Team;
  dim?: boolean;
  fresh?: boolean;
  selected?: boolean;
}) {
  const hex = markerHex(node, roomTeam);
  const label = markerLabelText(node);
  return (
    <g
      data-node-id={node.id}
      data-node-type="marker"
      data-marker-kind={node.kind}
      data-layer={node.layer}
      opacity={dim ? 0.6 : undefined}
    >
      {node.kind === "danger" && node.radius !== null ? (
        <circle
          cx={(node.at.x * MAP_PX).toFixed(1)}
          cy={(node.at.y * MAP_PX).toFixed(1)}
          r={(node.radius * MAP_PX).toFixed(1)}
          fill={hex}
          fillOpacity={0.18}
          stroke={hex}
          strokeOpacity={0.7}
          strokeWidth={3}
          strokeDasharray="10 8"
        />
      ) : null}
      <g data-screen="" style={{ transform: screenTransform(node.at) }}>
        {selected ? (
          <circle
            cx={0}
            cy={0}
            r={HALF + 4}
            fill="none"
            stroke={TOKEN_HEX.accent}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        ) : null}
        {fresh ? (
          <circle
            cx={0}
            cy={0}
            r={12}
            fill="none"
            stroke={hex}
            strokeWidth={2}
            style={{ transformOrigin: "0 0", animation: "wd-drop-ring 220ms ease-out both" }}
          />
        ) : null}
        <g
          style={
            fresh
              ? {
                  transformOrigin: "0 0",
                  animation: "wd-drop 220ms cubic-bezier(0.2,0.7,0.2,1) both",
                }
              : undefined
          }
        >
          <use
            href={`#${symbolId(node.kind)}`}
            x={-HALF}
            y={-HALF}
            width={MARKER_PX}
            height={MARKER_PX}
            color={hex}
          />
          <MarkerLabel text={label} y={HALF + 12} />
        </g>
      </g>
    </g>
  );
});

/** Pins sit up-right of their anchor with a leader line so they never cover the marker they belong to. */
const PIN_DX = 18;
const PIN_DY = -22;
const PIN_K = 0.85;

export const RequestPin = React.memo(function RequestPin({
  request,
  index,
  highlighted,
}: {
  request: SupplyRequest;
  index: number;
  highlighted?: boolean;
}) {
  if (!request.at) return null;
  const hex = requestHex(request.status);
  return (
    <g data-request-id={request.id} data-request-status={request.status}>
      <title>{describeRequest(request)}</title>
      <g data-screen="" style={{ transform: screenTransform(request.at) }}>
        <line
          x1={0}
          y1={0}
          x2={PIN_DX}
          y2={PIN_DY}
          stroke={hex}
          strokeWidth={1.5}
          strokeOpacity={0.9}
        />
        <circle cx={0} cy={0} r={3} fill={hex} stroke={TOKEN_HEX.bg0} strokeWidth={1.5} />
        <g style={{ transform: `translate(${PIN_DX}px, ${PIN_DY}px)` }}>
          {highlighted ? (
            <circle
              cx={0}
              cy={0}
              r={HALF + 2}
              fill={TOKEN_HEX.accent}
              fillOpacity={0.25}
              stroke={TOKEN_HEX.accent}
              strokeWidth={2}
            />
          ) : null}
          <use
            href={`#${REQUEST_SYMBOL_ID}`}
            x={-HALF * PIN_K}
            y={-HALF * PIN_K}
            width={MARKER_PX * PIN_K}
            height={MARKER_PX * PIN_K}
            color={hex}
          />
          {request.priority === "urgent" && request.status !== "delivered" ? (
            <circle
              cx={HALF * PIN_K - 3}
              cy={-HALF * PIN_K + 3}
              r={4.5}
              fill={TOKEN_HEX.danger}
              stroke={TOKEN_HEX.bg0}
              strokeWidth={1.5}
            />
          ) : null}
          <text
            x={0}
            y={5}
            textAnchor="middle"
            fontFamily={LABEL_FONT}
            fontSize={11}
            fontWeight={700}
            fill={hex}
            stroke={TOKEN_HEX.bg0}
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {index}
          </text>
          <text
            x={HALF * PIN_K + 4}
            y={4}
            textAnchor="start"
            fontFamily={LABEL_FONT}
            fontSize={10}
            fontWeight={700}
            letterSpacing="0.08em"
            fill={hex}
            stroke={TOKEN_HEX.bg0}
            strokeWidth={3}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {request.kind.toUpperCase()}
          </text>
        </g>
      </g>
    </g>
  );
});

export function MarkerLayer({
  markers,
  requests,
  roomTeam,
  dimLayers,
  freshIds,
  selectedId,
  highlightId,
}: {
  markers: Marker[];
  requests: SupplyRequest[];
  roomTeam: Team;
  dimLayers?: ReadonlySet<string>;
  freshIds?: ReadonlySet<string>;
  selectedId?: string | null;
  highlightId?: string | null;
}) {
  return (
    <g data-layer-group="markers">
      {markers.map((n) => (
        <MarkerNode
          key={n.id}
          node={n}
          roomTeam={roomTeam}
          dim={dimLayers?.has(n.layer)}
          fresh={freshIds?.has(n.id)}
          selected={selectedId === n.id}
        />
      ))}
      {requests.map((r, i) => (
        <RequestPin key={r.id} request={r} index={i + 1} highlighted={highlightId === r.id} />
      ))}
    </g>
  );
}
