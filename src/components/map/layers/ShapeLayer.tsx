// Arrows, lines, circles and rectangles: world-scaled strokes (§4.3.2).
import * as React from "react";
import { MAP_PX, type Shape, type ShapeKind, type InkColor, type Point } from "@/lib/map/types";
import { inkHex, SHAPE_STROKE_PX } from "../lib/palette";

const f = (n: number) => n.toFixed(1);

export function shapeGeometry(shape: ShapeKind, a: Point, b: Point) {
  const ax = a.x * MAP_PX;
  const ay = a.y * MAP_PX;
  const bx = b.x * MAP_PX;
  const by = b.y * MAP_PX;
  return { ax, ay, bx, by };
}

/** Arrow head: a filled triangle at b pointing away from a (length 4× the stroke). */
export function arrowHead(ax: number, ay: number, bx: number, by: number, w: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const h = w * 4.5;
  const half = w * 2.2;
  const baseX = bx - ux * h;
  const baseY = by - uy * h;
  return `M ${f(bx)} ${f(by)} L ${f(baseX + -uy * half)} ${f(baseY + ux * half)} L ${f(baseX - -uy * half)} ${f(baseY - ux * half)} Z`;
}

export function ShapeBody({
  shape,
  a,
  b,
  color,
  width = SHAPE_STROKE_PX,
  dashed,
  hitArea,
}: {
  shape: ShapeKind;
  a: Point;
  b: Point;
  color: InkColor | string;
  width?: number;
  dashed?: boolean;
  /** Add a wide transparent stroke so thin lines are easy to click. */
  hitArea?: boolean;
}) {
  const hex = color.startsWith("#") ? color : inkHex(color as InkColor);
  const { ax, ay, bx, by } = shapeGeometry(shape, a, b);
  const common = {
    stroke: hex,
    strokeWidth: width,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashed ? `${width * 3} ${width * 2}` : undefined,
  };
  const hit = hitArea ? { stroke: "rgba(0,0,0,0)", strokeWidth: width * 5, fill: "none" } : null;
  switch (shape) {
    case "line":
      return (
        <>
          {hit ? <line x1={f(ax)} y1={f(ay)} x2={f(bx)} y2={f(by)} {...hit} /> : null}
          <line x1={f(ax)} y1={f(ay)} x2={f(bx)} y2={f(by)} {...common} />
        </>
      );
    case "arrow": {
      const h = width * 4.5;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      // Stop the shaft short of the tip so the head is crisp.
      const ex = bx - ((bx - ax) / len) * h * 0.7;
      const ey = by - ((by - ay) / len) * h * 0.7;
      return (
        <>
          {hit ? <line x1={f(ax)} y1={f(ay)} x2={f(bx)} y2={f(by)} {...hit} /> : null}
          <line x1={f(ax)} y1={f(ay)} x2={f(ex)} y2={f(ey)} {...common} />
          <path
            d={arrowHead(ax, ay, bx, by, width)}
            fill={hex}
            stroke={hex}
            strokeWidth={width * 0.5}
            strokeLinejoin="round"
          />
        </>
      );
    }
    case "circle": {
      const r = Math.hypot(bx - ax, by - ay);
      return (
        <>
          {hit ? <circle cx={f(ax)} cy={f(ay)} r={f(r)} {...hit} /> : null}
          <circle cx={f(ax)} cy={f(ay)} r={f(r)} {...common} />
        </>
      );
    }
    case "rect": {
      const x = Math.min(ax, bx);
      const y = Math.min(ay, by);
      const w = Math.abs(bx - ax);
      const hgt = Math.abs(by - ay);
      return (
        <>
          {hit ? <rect x={f(x)} y={f(y)} width={f(w)} height={f(hgt)} {...hit} /> : null}
          <rect x={f(x)} y={f(y)} width={f(w)} height={f(hgt)} {...common} />
        </>
      );
    }
  }
}

export const ShapeNode = React.memo(function ShapeNode({
  node,
  dim,
  fresh,
}: {
  node: Shape;
  dim?: boolean;
  fresh?: boolean;
}) {
  return (
    <g
      data-node-id={node.id}
      data-node-type="shape"
      data-layer={node.layer}
      opacity={dim ? 0.6 : undefined}
      style={fresh ? { animation: "wd-ink-in 120ms cubic-bezier(0.2,0.7,0.2,1) both" } : undefined}
    >
      <ShapeBody shape={node.shape} a={node.a} b={node.b} color={node.color} hitArea />
    </g>
  );
});

export function ShapeLayer({
  nodes,
  dimLayers,
  freshIds,
}: {
  nodes: Shape[];
  dimLayers?: ReadonlySet<string>;
  freshIds?: ReadonlySet<string>;
}) {
  return (
    <g data-layer-group="shapes">
      {nodes.map((n) => (
        <ShapeNode key={n.id} node={n} dim={dimLayers?.has(n.layer)} fresh={freshIds?.has(n.id)} />
      ))}
    </g>
  );
}
