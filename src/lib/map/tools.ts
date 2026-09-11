// Tool state machine (§3.4): pure, driven by synthetic samples; the UI feeds pointer events in
// map space. text / request / ping / select need DOM input and live in the UI.
import { bearingDeg, clampPoint, distance, snapAngle, type Point } from "../geo";
import type { Team } from "../../config/site";
import { simplify } from "./ink";
import {
  DEFAULT_DANGER_RADIUS,
  DEFAULT_STROKE_WIDTH,
  MARKER_META,
  type ClientId,
  type InkColor,
  type LayerId,
  type MapNode,
  type Marker,
  type MarkerKind,
  type Measurement,
  type OpBody,
  type Shape,
  type ShapeKind,
  type Stroke,
  type Tool,
} from "./types";

export interface Sample {
  p: Point;
  t: number;
  pressure: number;
  shift: boolean;
  alt: boolean;
}
export type ToolPreview =
  | { t: "stroke"; points: Point[]; color: InkColor }
  | { t: "shape"; shape: ShapeKind; a: Point; b: Point; color: InkColor }
  | { t: "measure"; a: Point; b: Point; metres: number | null; bearing: number }
  | { t: "marker"; kind: MarkerKind; at: Point }
  | { t: "none" };
export interface ToolContext {
  tool: Tool;
  ink: InkColor;
  markerKind: MarkerKind;
  enemyTeam: Team;
  layer: LayerId;
  author: ClientId;
  authorName: string;
  widthMetres: number | null;
  now: () => number;
  id: () => string;
}
export interface ToolSession {
  preview: ToolPreview;
  down(s: Sample): ToolSession;
  move(s: Sample): ToolSession;
  up(s: Sample): { session: ToolSession; op: OpBody | null; commit?: MapNode };
  cancel(): ToolSession;
}

/** Shapes, lines and measurements shorter than this are taps, not commits. */
export const MIN_SHAPE_DISTANCE = 0.004;
export const SNAP_STEP_DEG = 15;

const NONE: ToolPreview = { t: "none" };

function base(ctx: ToolContext) {
  return {
    id: ctx.id(),
    layer: ctx.layer,
    author: ctx.author,
    authorName: ctx.authorName,
    createdAt: ctx.now(),
  };
}

/** Shift constrains a rect to a square and snaps the circle's radius handle to 45°. */
function constrain(shape: ShapeKind, a: Point, b: Point, shift: boolean): Point {
  if (!shift) return b;
  if (shape === "line" || shape === "arrow") return clampPoint(snapAngle(a, b, SNAP_STEP_DEG));
  if (shape === "circle") return clampPoint(snapAngle(a, b, 45));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return clampPoint({ x: a.x + Math.sign(dx || 1) * side, y: a.y + Math.sign(dy || 1) * side });
}

function idle(ctx: ToolContext, preview: ToolPreview = NONE): ToolSession {
  const self: ToolSession = {
    preview,
    down: (s) => begin(ctx, s),
    move: () => self,
    up: () => ({ session: self, op: null }),
    cancel: () => idle(ctx),
  };
  return self;
}

function begin(ctx: ToolContext, s: Sample): ToolSession {
  const p = clampPoint(s.p);
  switch (ctx.tool) {
    case "pen":
      return penSession(ctx, [p]);
    case "arrow":
    case "line":
    case "circle":
    case "rect":
      return shapeSession(ctx, ctx.tool, p, p);
    case "measure":
      return measureSession(ctx, p, p);
    case "marker":
      return markerSession(ctx, p);
    default:
      return idle(ctx);
  }
}

function penSession(ctx: ToolContext, points: Point[]): ToolSession {
  const preview: ToolPreview = { t: "stroke", points, color: ctx.ink };
  const self: ToolSession = {
    preview,
    down: () => self,
    move: (s) => {
      const p = clampPoint(s.p);
      const last = points[points.length - 1];
      if (last.x === p.x && last.y === p.y) return self;
      return penSession(ctx, [...points, p]);
    },
    up: (s) => {
      const p = clampPoint(s.p);
      const last = points[points.length - 1];
      const raw = last.x === p.x && last.y === p.y ? points : [...points, p];
      let pts = simplify(raw);
      if (pts.length < 2) pts = [pts[0] ?? p, pts[0] ?? p];
      const node: Stroke = {
        ...base(ctx),
        t: "stroke",
        color: ctx.ink,
        width: DEFAULT_STROKE_WIDTH,
        points: pts,
      };
      return { session: idle(ctx), op: { t: "node.add", nodes: [node] }, commit: node };
    },
    cancel: () => idle(ctx),
  };
  return self;
}

function shapeSession(ctx: ToolContext, shape: ShapeKind, a: Point, b: Point): ToolSession {
  const preview: ToolPreview = { t: "shape", shape, a, b, color: ctx.ink };
  const self: ToolSession = {
    preview,
    down: () => self,
    move: (s) => shapeSession(ctx, shape, a, constrain(shape, a, clampPoint(s.p), s.shift)),
    up: (s) => {
      const end = constrain(shape, a, clampPoint(s.p), s.shift);
      if (distance(a, end) <= MIN_SHAPE_DISTANCE) return { session: idle(ctx), op: null };
      const node: Shape = { ...base(ctx), t: "shape", shape, color: ctx.ink, a, b: end };
      return { session: idle(ctx), op: { t: "node.add", nodes: [node] }, commit: node };
    },
    cancel: () => idle(ctx),
  };
  return self;
}

/** Metres for a segment, or null when the map has no scale (uploads). */
export function measureMetres(a: Point, b: Point, widthMetres: number | null): number | null {
  return widthMetres === null ? null : distance(a, b) * widthMetres;
}

function measureSession(ctx: ToolContext, a: Point, b: Point): ToolSession {
  const preview: ToolPreview = {
    t: "measure",
    a,
    b,
    metres: measureMetres(a, b, ctx.widthMetres),
    bearing: bearingDeg(a, b),
  };
  const self: ToolSession = {
    preview,
    down: () => self,
    move: (s) => measureSession(ctx, a, constrain("line", a, clampPoint(s.p), s.shift)),
    up: (s) => {
      const end = constrain("line", a, clampPoint(s.p), s.shift);
      if (distance(a, end) <= MIN_SHAPE_DISTANCE) return { session: idle(ctx), op: null };
      const node: Measurement = { ...base(ctx), t: "measure", a, b: end, color: ctx.ink };
      return { session: idle(ctx), op: { t: "node.add", nodes: [node] }, commit: node };
    },
    cancel: () => idle(ctx),
  };
  return self;
}

/** Build the marker a tap would place; the enemy group carries the room's chosen enemy faction. */
export function markerAt(ctx: ToolContext, at: Point): Marker {
  const meta = MARKER_META[ctx.markerKind];
  return {
    ...base(ctx),
    t: "marker",
    kind: ctx.markerKind,
    at: clampPoint(at),
    label: meta.short,
    radius: ctx.markerKind === "danger" ? DEFAULT_DANGER_RADIUS : null,
    team: meta.group === "enemy" ? ctx.enemyTeam : null,
  };
}

function markerSession(ctx: ToolContext, at: Point): ToolSession {
  const node = markerAt(ctx, at);
  const preview: ToolPreview = { t: "marker", kind: ctx.markerKind, at };
  const self: ToolSession = {
    preview,
    down: () => self,
    move: () => self,
    // Commits with the point of the tap (down), not where the finger lifted.
    up: () => ({ session: idle(ctx), op: { t: "node.add", nodes: [node] }, commit: node }),
    cancel: () => idle(ctx),
  };
  return self;
}

export function startTool(ctx: ToolContext): ToolSession {
  return idle(ctx);
}
