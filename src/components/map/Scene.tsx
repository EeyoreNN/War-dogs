// The SVG scene shared by the static preview, the hero player and the live app (§4.3.2): the
// marker symbols in <defs>, then ONE world group holding every layer in z-order. Nothing here
// uses hooks, so a server component can render it.
import type * as React from "react";
import type { ControlZone } from "@/lib/terrain/types";
import type {
  LayerId,
  MapNode,
  Marker,
  Measurement,
  NodePatch,
  Ping,
  Presence,
  RoomState,
  RosterMember,
  Shape,
  Stroke,
  SupplyRequest,
  TextLabel,
  Viewport,
} from "@/lib/map/types";
import type { ToolPreview } from "@/lib/map/tools";
import { withPatch } from "./lib/hit";
import { worldMatrix } from "./lib/screen";
import { MarkerDefs } from "./MarkerSprite";
import { CursorLayer } from "./layers/CursorLayer";
import { GridLayer } from "./layers/GridLayer";
import { MarkerLayer } from "./layers/MarkerLayer";
import { MeasureBody, MeasureLayer } from "./layers/MeasureLayer";
import { PingLayer } from "./layers/PingLayer";
import { SelectionLayer } from "./layers/SelectionLayer";
import { ShapeBody, ShapeLayer } from "./layers/ShapeLayer";
import { StrokeLayer } from "./layers/StrokeLayer";
import { TextLayer } from "./layers/TextLayer";
import { ZoneLayer } from "./layers/ZoneLayer";

export interface SceneNodes {
  strokes: Stroke[];
  shapes: Shape[];
  measures: Measurement[];
  markers: Marker[];
  texts: TextLabel[];
}

/** Partition `state.order` by type, keeping only `visible` layers, applying a drag preview patch. */
export function partitionNodes(
  state: RoomState,
  visible: readonly LayerId[] | null,
  patchPreview?: { id: string; patch: NodePatch } | null,
): SceneNodes {
  const out: SceneNodes = { strokes: [], shapes: [], measures: [], markers: [], texts: [] };
  const allow = visible ? new Set<string>(visible) : null;
  for (const id of state.order) {
    let n: MapNode = state.nodes[id];
    if (!n || (allow && !allow.has(n.layer))) continue;
    if (patchPreview && patchPreview.id === id) n = withPatch(n, patchPreview.patch);
    switch (n.t) {
      case "stroke":
        out.strokes.push(n);
        break;
      case "shape":
        out.shapes.push(n);
        break;
      case "measure":
        out.measures.push(n);
        break;
      case "marker":
        out.markers.push(n);
        break;
      case "text":
        out.texts.push(n);
        break;
    }
  }
  return out;
}

export interface SceneProps {
  state: RoomState;
  nodes: SceneNodes;
  viewport: Viewport;
  zone: ControlZone | null;
  widthMetres: number | null;
  showGrid: boolean;
  subgrid?: boolean;
  dimLayers?: ReadonlySet<string>;
  freshIds?: ReadonlySet<string>;
  selectedNode?: MapNode | null;
  highlightId?: string | null;
  editingId?: string | null;
  pings?: Ping[];
  presence?: Record<string, Presence>;
  roster?: Record<string, RosterMember>;
  self?: string | null;
  showCursors?: boolean;
  toolPreview?: ToolPreview | null;
  reducedMotion?: boolean;
  worldRef?: React.Ref<SVGGElement>;
  /** Requests with a location, in panel order (pins are numbered by it). */
  pinnedRequests?: SupplyRequest[];
}

export function Scene({
  state,
  nodes,
  viewport,
  zone,
  widthMetres,
  showGrid,
  subgrid,
  dimLayers,
  freshIds,
  selectedNode,
  highlightId,
  editingId,
  pings,
  presence,
  roster,
  self,
  showCursors,
  toolPreview,
  reducedMotion,
  worldRef,
  pinnedRequests,
}: SceneProps) {
  const team = state.settings.team;
  const requests =
    pinnedRequests ??
    Object.values(state.requests)
      .filter((r) => r.at)
      .sort((a, b) => a.createdAt - b.createdAt);
  return (
    <>
      <MarkerDefs />
      <g ref={worldRef} data-export="world" transform={worldMatrix(viewport)}>
        {showGrid ? <GridLayer subgrid={subgrid} /> : null}
        <ZoneLayer zone={zone} />
        <StrokeLayer nodes={nodes.strokes} dimLayers={dimLayers} freshIds={freshIds} />
        <ShapeLayer nodes={nodes.shapes} dimLayers={dimLayers} freshIds={freshIds} />
        <MeasureLayer nodes={nodes.measures} widthMetres={widthMetres} dimLayers={dimLayers} />
        <MarkerLayer
          markers={nodes.markers}
          requests={requests}
          roomTeam={team}
          dimLayers={dimLayers}
          freshIds={freshIds}
          selectedId={selectedNode?.id ?? null}
          highlightId={highlightId}
        />
        <TextLayer nodes={nodes.texts} dimLayers={dimLayers} editingId={editingId} />
        {toolPreview && toolPreview.t === "shape" ? (
          <g data-export="skip" pointerEvents="none">
            <ShapeBody
              shape={toolPreview.shape}
              a={toolPreview.a}
              b={toolPreview.b}
              color={toolPreview.color}
              dashed
            />
          </g>
        ) : null}
        {toolPreview && toolPreview.t === "measure" ? (
          <g data-export="skip" pointerEvents="none">
            <MeasureBody
              a={toolPreview.a}
              b={toolPreview.b}
              color="white"
              widthMetres={widthMetres}
              preview
            />
          </g>
        ) : null}
        {pings && pings.length ? <PingLayer pings={pings} reducedMotion={reducedMotion} /> : null}
        {showCursors && presence && roster ? (
          <CursorLayer presence={presence} roster={roster} self={self ?? null} />
        ) : null}
        <SelectionLayer node={selectedNode ?? null} />
      </g>
    </>
  );
}
