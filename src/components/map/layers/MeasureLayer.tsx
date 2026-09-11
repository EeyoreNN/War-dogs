// Measurements: a world-scaled line with end ticks and a screen-constant label (§4.3.3).
import * as React from "react";
import { bearingDeg, distance } from "@/lib/geo";
import { MAP_PX, type Measurement, type Point, type InkColor } from "@/lib/map/types";
import { measureLabel } from "../lib/format";
import { inkHex, MEASURE_STROKE_PX, TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";

const f = (n: number) => n.toFixed(1);

export function MeasureBody({
  a,
  b,
  color,
  widthMetres,
  preview,
}: {
  a: Point;
  b: Point;
  color: InkColor;
  widthMetres: number | null;
  preview?: boolean;
}) {
  const hex = inkHex(color);
  const ax = a.x * MAP_PX;
  const ay = a.y * MAP_PX;
  const bx = b.x * MAP_PX;
  const by = b.y * MAP_PX;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * 12;
  const ny = ((bx - ax) / len) * 12;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const label = measureLabel(distance(a, b), bearingDeg(a, b), widthMetres);
  const w = MEASURE_STROKE_PX;
  return (
    <>
      <line
        x1={f(ax)}
        y1={f(ay)}
        x2={f(bx)}
        y2={f(by)}
        stroke="rgba(0,0,0,0)"
        strokeWidth={w * 5}
        fill="none"
      />
      <line
        x1={f(ax)}
        y1={f(ay)}
        x2={f(bx)}
        y2={f(by)}
        stroke={hex}
        strokeWidth={w}
        strokeDasharray={preview ? `${w * 2} ${w * 2}` : undefined}
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1={f(ax + nx)}
        y1={f(ay + ny)}
        x2={f(ax - nx)}
        y2={f(ay - ny)}
        stroke={hex}
        strokeWidth={w}
        fill="none"
      />
      <line
        x1={f(bx + nx)}
        y1={f(by + ny)}
        x2={f(bx - nx)}
        y2={f(by - ny)}
        stroke={hex}
        strokeWidth={w}
        fill="none"
      />
      <g data-screen="" style={{ transform: screenTransform(mid) }}>
        <rect
          x={-label.length * 3.6 - 6}
          y={-22}
          width={label.length * 7.2 + 12}
          height={18}
          rx={3}
          fill={TOKEN_HEX.bg0}
          fillOpacity={0.82}
        />
        <text
          x={0}
          y={-9}
          textAnchor="middle"
          fontFamily="JetBrains Mono, ui-monospace, Menlo, monospace"
          fontSize={11}
          fontWeight={700}
          fill={hex}
          letterSpacing="0.04em"
        >
          {label}
        </text>
      </g>
    </>
  );
}

export const MeasureNode = React.memo(function MeasureNode({
  node,
  widthMetres,
  dim,
}: {
  node: Measurement;
  widthMetres: number | null;
  dim?: boolean;
}) {
  return (
    <g
      data-node-id={node.id}
      data-node-type="measure"
      data-layer={node.layer}
      opacity={dim ? 0.6 : undefined}
    >
      <MeasureBody a={node.a} b={node.b} color={node.color} widthMetres={widthMetres} />
    </g>
  );
});

export function MeasureLayer({
  nodes,
  widthMetres,
  dimLayers,
}: {
  nodes: Measurement[];
  widthMetres: number | null;
  dimLayers?: ReadonlySet<string>;
}) {
  return (
    <g data-layer-group="measures">
      {nodes.map((n) => (
        <MeasureNode key={n.id} node={n} widthMetres={widthMetres} dim={dimLayers?.has(n.layer)} />
      ))}
    </g>
  );
}
