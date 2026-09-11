"use client";

// The map surface (§4.3.2–4.3.3): terrain canvas below, the SVG scene with one world transform,
// an overlay canvas for the in-progress stroke, pointer / touch / wheel / keyboard handling and
// the tool state machine from the engine. The viewport is written imperatively (one matrix +
// `--inv` per change); React re-renders only for nodes, previews and the rare zoom bucket change.
import * as React from "react";
import { clamp01, distance } from "@/lib/geo";
import { gridRef } from "@/lib/map/grid";
import { newId } from "@/lib/map/ids";
import { outlineToPath, strokeOutline } from "@/lib/map/ink";
import { canDraw, editableLayer, isCommand, visibleLayers } from "@/lib/map/roster";
import {
  startTool,
  type Sample,
  type ToolContext,
  type ToolPreview,
  type ToolSession,
} from "@/lib/map/tools";
import {
  DEFAULT_STROKE_WIDTH,
  MAP_PX,
  type MapNode,
  type NodePatch,
  type Point,
  type Viewport,
} from "@/lib/map/types";
import { clampViewport, fitToBox, panBy, screenToWorld, zoomAt } from "@/lib/map/viewport";
import { mapById } from "@/config/maps";
import { announce } from "@/components/ui/live-region";
import { now, selectMe, useRoomStore } from "@/store/room";
import {
  addRequest,
  addText,
  placeMarker,
  removeNodes,
  renameNode,
  nudgeNode,
  updateNode,
} from "./actions";
import { useMapApp } from "./context";
import { handlePatch, type HandleId } from "./lib/hit";
import { inkHex, TOKEN_HEX } from "./lib/palette";
import {
  centreOn,
  inverseScale,
  isVisible,
  SUBGRID_FROM_SCALE,
  terrainBucket,
  terrainCanvasTransform,
  viewportCentre,
  worldMatrix,
  screenTransform,
} from "./lib/screen";
import { widthMetresFor, zoneFor } from "./lib/zone";
import { partitionNodes, Scene } from "./Scene";
import { TextEditor } from "./TextEditor";
import { exportRaster, useTerrainCanvas } from "./useTerrain";
import { useUiStore, type ViewportApi } from "./ui-store";

const ZOOM_STEP = 1.4;
const TAP_MS = 260;
const TAP_PX = 5;
const DBL_MS = 320;
const DBL_PX = 10;
const LONG_PRESS_MS = 500;
const DEFER_MS = 230;
const INITIAL_VP: Viewport = { scale: 0.4, tx: 0, ty: 0 };

/** Fit the whole map; on a portrait phone fit the width so the map spans the screen edge to edge. */
function fitMap(box: { w: number; h: number }): Viewport {
  const v = fitToBox(box);
  if (box.h > box.w * 1.2 && box.w < 768) {
    const scale = box.w / MAP_PX;
    return { scale, tx: 0, ty: (box.h - MAP_PX * scale) / 2 };
  }
  return v;
}

type Gesture =
  | { kind: "none" }
  | { kind: "pan"; id: number; last: Point }
  | { kind: "pinch"; lastDist: number; lastMid: Point }
  | { kind: "tool"; id: number; session: ToolSession; start: Point; startT: number; pen: boolean }
  | {
      kind: "drag";
      id: number;
      nodeId: string;
      node: MapNode;
      start: Point;
      el: Element;
      moved: boolean;
    }
  | { kind: "handle"; id: number; nodeId: string; handle: HandleId; node: MapNode }
  | {
      kind: "tap";
      id: number;
      what: "ping" | "request" | "text" | "node" | "none";
      start: Point;
      startT: number;
      nodeId?: string;
    };

interface KbDraw {
  tool: string | null;
  a: Point | null;
  points: Point[];
}

export function MapSurface({ className }: { className?: string }) {
  const { mode, isMobile, reducedMotion } = useMapApp();
  const state = useRoomStore((s) => s.state);
  const identity = useRoomStore((s) => s.me);
  const member = useRoomStore(selectMe);
  const tool = useRoomStore((s) => s.tool);
  const ink = useRoomStore((s) => s.ink);
  const markerKind = useRoomStore((s) => s.markerKind);
  const enemyTeam = useRoomStore((s) => s.enemyTeam);
  const selection = useRoomStore((s) => s.selection);
  const highlightId = useRoomStore((s) => s.highlightId);
  const grid = useRoomStore((s) => s.grid);
  const showPings = useRoomStore((s) => s.showPings);
  const storePings = useRoomStore((s) => s.pings);
  const presence = useRoomStore((s) => s.presence);
  const brief = useRoomStore((s) => s.brief);
  const uploadedMap = useRoomStore((s) => s.uploadedMap);
  const select = useRoomStore((s) => s.select);
  const ping = useRoomStore((s) => s.ping);
  const sendCursor = useRoomStore((s) => s.sendCursor);

  const placingRequest = useUiStore((s) => s.placingRequest);
  const pingArmed = useUiStore((s) => s.pingArmed);
  const textEditor = useUiStore((s) => s.textEditor);
  const freshIds = useUiStore((s) => s.freshIds);
  const hiddenLayers = useUiStore((s) => s.hiddenLayers);
  const uiSet = useUiStore((s) => s.set);

  const boxRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const worldRef = React.useRef<SVGGElement>(null);
  const terrainRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLCanvasElement>(null);
  const vpRef = React.useRef<Viewport>(INITIAL_VP);
  const boxSize = React.useRef({ w: 0, h: 0 });
  const bucketRef = React.useRef(1024);
  const subgridRef = React.useRef(false);
  const fitted = React.useRef(false);
  const gesture = React.useRef<Gesture>({ kind: "none" });
  const pointers = React.useRef(new Map<number, Point>());
  const lastDown = React.useRef<{ t: number; p: Point } | null>(null);
  const dblRef = React.useRef(false);
  const pendingTap = React.useRef<{ timer: ReturnType<typeof setTimeout> } | null>(null);
  const longPress = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const spaceHeld = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const penPoints = React.useRef<Point[]>([]);

  const [bucket, setBucket] = React.useState(1024);
  const [subgrid, setSubgrid] = React.useState(false);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const [toolPreview, setToolPreview] = React.useState<ToolPreview | null>(null);
  const [patchPreview, setPatchPreview] = React.useState<{ id: string; patch: NodePatch } | null>(
    null,
  );
  const [crosshair, setCrosshair] = React.useState<Point | null>(null);
  const [mapFocused, setMapFocused] = React.useState(false);
  const [kbState, setKbState] = React.useState<KbDraw>({ tool: null, a: null, points: [] });
  // Keyboard drawing state belongs to one tool: switching tools discards it (derived, no effect).
  const kb: KbDraw = kbState.tool === tool ? kbState : { tool, a: null, points: [] };
  const setKb = React.useCallback(
    (next: { a: Point | null; points: Point[] }) => setKbState({ tool, ...next }),
    [tool],
  );
  const [initialVp, setInitialVp] = React.useState<Viewport>(INITIAL_VP);

  if (!state || !identity) throw new Error("MapSurface needs room state");
  const settings = state.settings;
  const mapDef = mapById(settings.map);
  const widthMetres = widthMetresFor(settings);
  const drawAllowed = canDraw(member, settings) && !brief;
  const editable = editableLayer(settings, member);
  const uploadReady = uploadedMap?.status === "ready";

  // ---- viewport -----------------------------------------------------------------------------
  const applyViewport = React.useCallback((v: Viewport) => {
    const clamped = boxSize.current.w ? clampViewport(v, boxSize.current) : v;
    vpRef.current = clamped;
    worldRef.current?.setAttribute("transform", worldMatrix(clamped));
    svgRef.current?.style.setProperty("--inv", String(inverseScale(clamped)));
    const canvas = terrainRef.current;
    if (canvas) canvas.style.transform = terrainCanvasTransform(clamped, bucketRef.current);
    const dpr = window.devicePixelRatio || 1;
    const b = terrainBucket(clamped.scale, dpr);
    if (b !== bucketRef.current) {
      bucketRef.current = b;
      if (canvas) canvas.style.transform = terrainCanvasTransform(clamped, b);
      setBucket(b);
    }
    const sub = clamped.scale >= SUBGRID_FROM_SCALE;
    if (sub !== subgridRef.current) {
      subgridRef.current = sub;
      setSubgrid(sub);
    }
  }, []);

  // Measure the box; fit on first measure, clamp afterwards.
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      boxSize.current = { w, h };
      setBox({ w, h });
      const overlay = overlayRef.current;
      if (overlay) {
        const dpr = window.devicePixelRatio || 1;
        overlay.width = Math.round(w * dpr);
        overlay.height = Math.round(h * dpr);
      }
      if (!fitted.current) {
        fitted.current = true;
        const v = fitMap({ w, h });
        applyViewport(v);
        setInitialVp(v);
      } else applyViewport(vpRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyViewport]);

  useTerrainCanvas(terrainRef, settings.map, settings.mapSource, bucket, uploadReady);

  const toLocal = (e: { clientX: number; clientY: number }): Point => {
    const r = boxRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const toWorld = (local: Point): Point => screenToWorld(vpRef.current, local);
  const crosshairPoint = React.useCallback((): Point => {
    return crosshair ?? viewportCentre(vpRef.current, boxSize.current);
  }, [crosshair]);

  // ---- tool context -------------------------------------------------------------------------
  const toolCtx: ToolContext = {
    tool,
    ink,
    markerKind,
    enemyTeam,
    layer: editable,
    author: identity.client,
    authorName: identity.callsign,
    widthMetres,
    now,
    id: newId,
  };
  const inkRef = React.useRef(ink);
  React.useEffect(() => {
    inkRef.current = ink;
  }, [ink]);
  const sample = (
    p: Point,
    e?: { shiftKey?: boolean; altKey?: boolean; pressure?: number },
  ): Sample => ({
    p: { x: clamp01(p.x), y: clamp01(p.y) },
    t: now(),
    pressure: e?.pressure ?? 0.5,
    shift: !!e?.shiftKey,
    alt: !!e?.altKey,
  });

  const commitOp = React.useCallback((result: ReturnType<ToolSession["up"]>) => {
    if (!result.op) return;
    const s = useRoomStore.getState();
    const op = s.dispatch(result.op);
    if (op && result.commit) {
      useUiStore.getState().markFresh([result.commit.id]);
      if (result.commit.t === "marker") {
        s.select(result.commit.id);
        announce(`${result.commit.label} placed at ${gridRef(result.commit.at)}`);
      }
    }
  }, []);

  // ---- overlay stroke -----------------------------------------------------------------------
  const drawOverlay = React.useCallback(() => {
    rafRef.current = null;
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pts = penPoints.current;
    if (pts.length === 0) return;
    const v = vpRef.current;
    const k = MAP_PX * v.scale;
    const screen = pts.map((p) => ({ x: p.x * k + v.tx, y: p.y * k + v.ty }));
    const outline = strokeOutline(screen, DEFAULT_STROKE_WIDTH * k);
    ctx.fillStyle = inkHex(inkRef.current);
    ctx.fill(new Path2D(outlineToPath(outline)));
  }, []);
  const scheduleOverlay = () => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(drawOverlay);
  };
  const clearOverlay = () => {
    penPoints.current = [];
    scheduleOverlay();
  };

  // ---- pointer events -----------------------------------------------------------------------
  const cancelGesture = () => {
    const g = gesture.current;
    if (g.kind === "tool") {
      g.session.cancel();
      setToolPreview(null);
      clearOverlay();
    } else if (g.kind === "drag") g.el.removeAttribute("transform");
    else if (g.kind === "handle") setPatchPreview(null);
    gesture.current = { kind: "none" };
  };
  const clearLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    const local = toLocal(e);
    pointers.current.set(e.pointerId, local);
    setCrosshair(null);
    if (pointers.current.size === 2) {
      cancelGesture();
      clearLongPress();
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        lastDist: distance(a, b),
        lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      return;
    }
    if (pointers.current.size > 2) return;
    const t = now();
    const dbl =
      !!lastDown.current &&
      t - lastDown.current.t < DBL_MS &&
      distance(local, lastDown.current.p) < DBL_PX;
    lastDown.current = { t, p: local };
    dblRef.current = dbl;
    if (dbl && pendingTap.current) {
      clearTimeout(pendingTap.current.timer);
      pendingTap.current = null;
    }
    const target = e.target as Element;
    const nodeEl = target.closest?.("[data-node-id]");
    const nodeId = nodeEl?.getAttribute("data-node-id") ?? null;
    const handle = target
      .closest?.("[data-handle]")
      ?.getAttribute("data-handle") as HandleId | null;
    const world = toWorld(local);

    if (e.button === 1 || spaceHeld.current) {
      gesture.current = { kind: "pan", id: e.pointerId, last: local };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (dbl && nodeId && tool === "select") {
      const n = state.nodes[nodeId];
      if (n && (n.t === "marker" || n.t === "text") && drawAllowed) {
        uiSet({
          textEditor: {
            at: n.at,
            nodeId,
            initial: n.t === "marker" ? n.label : n.text,
            kind: n.t === "marker" ? "label" : "text",
          },
        });
        gesture.current = { kind: "none" };
        return;
      }
    }
    if (pingArmed) {
      gesture.current = { kind: "tap", id: e.pointerId, what: "ping", start: local, startT: t };
      return;
    }
    if (placingRequest) {
      gesture.current = { kind: "tap", id: e.pointerId, what: "request", start: local, startT: t };
      return;
    }
    if (handle && selection && drawAllowed) {
      const n = state.nodes[selection];
      if (n) {
        gesture.current = { kind: "handle", id: e.pointerId, nodeId: selection, handle, node: n };
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    if (tool === "select" || !drawAllowed || brief) {
      if (nodeId && state.nodes[nodeId]) {
        select(nodeId);
        const n = state.nodes[nodeId];
        const canMove = drawAllowed && (isCommand(member) || n.layer === editable);
        if (canMove && nodeEl) {
          gesture.current = {
            kind: "drag",
            id: e.pointerId,
            nodeId,
            node: n,
            start: local,
            el: nodeEl,
            moved: false,
          };
          svgRef.current?.setPointerCapture(e.pointerId);
        } else
          gesture.current = {
            kind: "tap",
            id: e.pointerId,
            what: "node",
            start: local,
            startT: t,
            nodeId,
          };
        return;
      }
      select(null);
      gesture.current = { kind: "pan", id: e.pointerId, last: local };
      svgRef.current?.setPointerCapture(e.pointerId);
      if (e.pointerType === "touch" && isMobile) {
        clearLongPress();
        longPress.current = setTimeout(() => {
          cancelGesture();
          uiSet({ markerSheet: { at: world } });
        }, LONG_PRESS_MS);
      }
      return;
    }
    if (tool === "text") {
      gesture.current = { kind: "tap", id: e.pointerId, what: "text", start: local, startT: t };
      return;
    }
    const session = startTool(toolCtx).down(sample(world, e));
    gesture.current = {
      kind: "tool",
      id: e.pointerId,
      session,
      start: local,
      startT: t,
      pen: tool === "pen",
    };
    svgRef.current?.setPointerCapture(e.pointerId);
    if (tool === "pen") {
      penPoints.current = session.preview.t === "stroke" ? session.preview.points : [world];
      scheduleOverlay();
    } else if (session.preview.t !== "none" && session.preview.t !== "marker")
      setToolPreview(session.preview);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const local = toLocal(e);
    const g = gesture.current;
    sendCursor(toWorld(local));
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, local);
    if (longPress.current && lastDown.current && distance(local, lastDown.current.p) > 8)
      clearLongPress();
    switch (g.kind) {
      case "pinch": {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const dist = distance(a, b);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        let v = zoomAt(vpRef.current, g.lastMid, dist / (g.lastDist || 1));
        v = panBy(v, mid.x - g.lastMid.x, mid.y - g.lastMid.y);
        applyViewport(v);
        g.lastDist = dist;
        g.lastMid = mid;
        return;
      }
      case "pan":
        if (e.pointerId !== g.id) return;
        applyViewport(panBy(vpRef.current, local.x - g.last.x, local.y - g.last.y));
        g.last = local;
        return;
      case "drag": {
        if (e.pointerId !== g.id) return;
        const dx = local.x - g.start.x;
        const dy = local.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) < 3) return;
        g.moved = true;
        const k = vpRef.current.scale;
        g.el.setAttribute("transform", `translate(${(dx / k).toFixed(2)} ${(dy / k).toFixed(2)})`);
        return;
      }
      case "handle": {
        if (e.pointerId !== g.id) return;
        const patch = handlePatch(g.node, g.handle, toWorld(local));
        if (patch) setPatchPreview({ id: g.nodeId, patch });
        return;
      }
      case "tool": {
        if (e.pointerId !== g.id) return;
        const native = e.nativeEvent as PointerEvent & {
          getCoalescedEvents?: () => PointerEvent[];
        };
        const events = g.pen && native.getCoalescedEvents ? native.getCoalescedEvents() : [native];
        let session = g.session;
        for (const ev of events.length ? events : [native])
          session = session.move(sample(toWorld(toLocal(ev)), ev));
        g.session = session;
        if (g.pen) {
          if (session.preview.t === "stroke") penPoints.current = session.preview.points;
          scheduleOverlay();
        } else if (session.preview.t !== "none" && session.preview.t !== "marker")
          setToolPreview(session.preview);
        return;
      }
      case "tap":
        if (e.pointerId === g.id && g.what === "node" && distance(local, g.start) > 8) {
          gesture.current = { kind: "pan", id: e.pointerId, last: local };
        }
        return;
      default:
        return;
    }
  };

  const finishTool = (
    g: Extract<Gesture, { kind: "tool" }>,
    local: Point,
    e: React.PointerEvent,
  ) => {
    const result = g.session.up(sample(toWorld(local), e));
    setToolPreview(null);
    const isTap = distance(local, g.start) < TAP_PX && now() - g.startT < TAP_MS;
    if (result.op && isTap && (g.pen || tool === "marker")) {
      // A second click within 320 ms turns this into a ping instead (§4.3.3 double-click precedence).
      const timer = setTimeout(() => {
        pendingTap.current = null;
        commitOp(result);
        clearOverlay();
      }, DEFER_MS);
      pendingTap.current = { timer };
      return;
    }
    commitOp(result);
    clearOverlay();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const local = toLocal(e);
    pointers.current.delete(e.pointerId);
    clearLongPress();
    const g = gesture.current;
    if (svgRef.current?.hasPointerCapture(e.pointerId))
      svgRef.current.releasePointerCapture(e.pointerId);
    switch (g.kind) {
      case "pinch":
        if (pointers.current.size < 2) gesture.current = { kind: "none" };
        return;
      case "pan":
        gesture.current = { kind: "none" };
        if (dblRef.current && !pingArmed) {
          const t = lastDown.current;
          if (t && distance(local, t.p) < DBL_PX) ping(toWorld(local));
        }
        return;
      case "drag": {
        gesture.current = { kind: "none" };
        g.el.removeAttribute("transform");
        if (g.moved) {
          const k = MAP_PX * vpRef.current.scale;
          nudgeNode(g.nodeId, (local.x - g.start.x) / k, (local.y - g.start.y) / k);
        }
        return;
      }
      case "handle": {
        gesture.current = { kind: "none" };
        const patch = handlePatch(g.node, g.handle, toWorld(local));
        setPatchPreview(null);
        if (patch) updateNode(g.nodeId, patch);
        return;
      }
      case "tool":
        gesture.current = { kind: "none" };
        if (dblRef.current) {
          g.session.cancel();
          setToolPreview(null);
          clearOverlay();
          ping(toWorld(local));
          return;
        }
        finishTool(g, local, e);
        return;
      case "tap": {
        gesture.current = { kind: "none" };
        const world = toWorld(local);
        if (g.what === "ping") {
          ping(world);
          uiSet({ pingArmed: false });
          announce(`Pinged ${gridRef(world)}`);
        } else if (g.what === "request" && placingRequest) {
          addRequest(placingRequest.kind, placingRequest.priority, placingRequest.note, world);
          uiSet({ placingRequest: null });
        } else if (g.what === "text") {
          if (dblRef.current) ping(world);
          else uiSet({ textEditor: { at: world, nodeId: null, initial: "", kind: "text" } });
        } else if (g.what === "node" && dblRef.current) {
          /* handled on down */
        }
        return;
      }
      default:
        return;
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    clearLongPress();
    cancelGesture();
  };

  // Wheel must be non-passive to stop the page from scrolling / zooming.
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018));
      applyViewport(zoomAt(vpRef.current, toLocal(e), factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyViewport]);

  // Space held = pan in any tool.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      )
        spaceHeld.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ---- keyboard on the map ------------------------------------------------------------------
  const moveCrosshair = (dx: number, dy: number) => {
    const c = crosshairPoint();
    const next = { x: clamp01(c.x + dx), y: clamp01(c.y + dy) };
    setCrosshair(next);
    if (!isVisible(vpRef.current, next, boxSize.current))
      applyViewport(centreOn(vpRef.current, next, boxSize.current));
    announce(gridRef(next, true));
  };

  const keyboardCommit = (a: Point, b: Point) => {
    const s = startTool(toolCtx).down(sample(a));
    const r = s.move(sample(b)).up(sample(b));
    commitOp(r);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    if (e.key === "Tab" && !e.shiftKey) {
      // The node list follows the map in tab order (§4.3.10), wherever it is docked.
      const list = useUiStore.getState().nodeListApi;
      if (list) {
        e.preventDefault();
        list.focus();
      }
      return;
    }
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (selection && drawAllowed && state.nodes[selection]) nudgeNode(selection, dx, dy);
        else {
          moveCrosshair(dx, dy);
          if (tool === "pen" && kb.points.length && drawAllowed) {
            const c = crosshairPoint();
            setKb({
              a: kb.a,
              points: [...kb.points, { x: clamp01(c.x + dx), y: clamp01(c.y + dy) }],
            });
          }
        }
        return;
      }
      case "Enter": {
        e.preventDefault();
        const c = crosshairPoint();
        if (pingArmed) {
          ping(c);
          uiSet({ pingArmed: false });
          announce(`Pinged ${gridRef(c)}`);
          return;
        }
        if (placingRequest) {
          addRequest(placingRequest.kind, placingRequest.priority, placingRequest.note, c);
          uiSet({ placingRequest: null });
          return;
        }
        if (selection && state.nodes[selection] && tool === "select") {
          const n = state.nodes[selection];
          if ((n.t === "marker" || n.t === "text") && drawAllowed)
            uiSet({
              textEditor: {
                at: n.at,
                nodeId: n.id,
                initial: n.t === "marker" ? n.label : n.text,
                kind: n.t === "marker" ? "label" : "text",
              },
            });
          return;
        }
        if (!drawAllowed) return;
        switch (tool) {
          case "marker":
            placeMarker(c);
            return;
          case "text":
            uiSet({ textEditor: { at: c, nodeId: null, initial: "", kind: "text" } });
            return;
          case "pen":
            if (kb.points.length === 0) {
              setKb({ a: null, points: [c] });
              announce("Stroke started. Arrow keys add points, Enter commits.");
            } else {
              const pts = [...kb.points, c];
              let s = startTool(toolCtx).down(sample(pts[0]));
              for (const p of pts.slice(1)) s = s.move(sample(p));
              commitOp(s.up(sample(pts[pts.length - 1])));
              setKb({ a: null, points: [] });
            }
            return;
          case "arrow":
          case "line":
          case "circle":
          case "rect":
          case "measure":
            if (!kb.a) {
              setKb({ a: c, points: [] });
              announce(`Point A at ${gridRef(c)}. Move the crosshair and press Enter for point B.`);
            } else {
              keyboardCommit(kb.a, c);
              setKb({ a: null, points: [] });
            }
            return;
          default:
            return;
        }
      }
      case "Escape": {
        if (kb.a || kb.points.length) {
          setKb({ a: null, points: [] });
          e.stopPropagation();
        } else if (pingArmed || placingRequest) {
          uiSet({ pingArmed: false, placingRequest: null });
          e.stopPropagation();
        } else if (selection) {
          select(null);
          e.stopPropagation();
        }
        return;
      }
      case "Delete":
      case "Backspace":
        if (selection && drawAllowed) {
          e.preventDefault();
          removeNodes([selection]);
          announce("Removed");
        }
        return;
      default:
        return;
    }
  };

  // ---- viewport API for the rest of the app --------------------------------------------------
  React.useEffect(() => {
    const api: ViewportApi = {
      zoomIn: () =>
        applyViewport(
          zoomAt(vpRef.current, { x: boxSize.current.w / 2, y: boxSize.current.h / 2 }, ZOOM_STEP),
        ),
      zoomOut: () =>
        applyViewport(
          zoomAt(
            vpRef.current,
            { x: boxSize.current.w / 2, y: boxSize.current.h / 2 },
            1 / ZOOM_STEP,
          ),
        ),
      fit: () => applyViewport(fitMap(boxSize.current)),
      centreOn: (p) => applyViewport(centreOn(vpRef.current, p, boxSize.current)),
      focusMap: () => svgRef.current?.focus({ preventScroll: true }),
      crosshair: () => crosshairPoint(),
      placeAtCrosshair: () => {
        placeMarker(crosshairPoint());
      },
      exportSvgElement: () => svgRef.current,
      terrainForExport: () => exportRaster(settings.map, settings.mapSource, uploadReady),
    };
    useUiStore.getState().set({ viewportApi: api });
    return () => useUiStore.getState().set({ viewportApi: null });
  }, [applyViewport, crosshairPoint, settings.map, settings.mapSource, uploadReady]);

  // ---- derived scene data --------------------------------------------------------------------
  const visible = React.useMemo(() => {
    const layers = visibleLayers(settings, member);
    return layers.filter((l) => !hiddenLayers.includes(l));
  }, [settings, member, hiddenLayers]);
  const dimLayers = React.useMemo(() => {
    if (!settings.squadMode || isCommand(member)) return undefined;
    return new Set(visible.filter((l) => l !== editable));
  }, [settings.squadMode, member, visible, editable]);
  const nodes = React.useMemo(
    () => partitionNodes(state, visible, patchPreview),
    [state, visible, patchPreview],
  );
  const zone = React.useMemo(
    () => (settings.mapSource.kind === "builtin" ? zoneFor(settings) : null),
    [settings],
  );
  const pinned = React.useMemo(
    () =>
      Object.values(state.requests)
        .filter((r) => r.at)
        .sort((a, b) => a.createdAt - b.createdAt),
    [state.requests],
  );
  const pings = React.useMemo(() => {
    const mine = identity.client;
    return showPings ? storePings : storePings.filter((p) => p.by === mine);
  }, [storePings, showPings, identity.client]);
  const selectedNode = selection ? (state.nodes[selection] ?? null) : null;
  const kbPreview: ToolPreview | null = React.useMemo(() => {
    if (!kb.a || !crosshair) return null;
    if (tool === "measure")
      return { t: "measure", a: kb.a, b: crosshair, metres: null, bearing: 0 };
    if (tool === "arrow" || tool === "line" || tool === "circle" || tool === "rect")
      return { t: "shape", shape: tool, a: kb.a, b: crosshair, color: ink };
    return null;
  }, [kb.a, crosshair, tool, ink]);

  const cursor =
    pingArmed || placingRequest || tool === "marker" || tool === "text"
      ? "crosshair"
      : tool === "select"
        ? "default"
        : brief
          ? "grab"
          : "crosshair";
  const style = { "--inv": String(inverseScale(initialVp)) } as React.CSSProperties;

  return (
    <div
      ref={boxRef}
      data-map-box=""
      className={`relative h-full w-full overflow-hidden bg-bg-0 select-none ${className ?? ""}`}
      style={{ touchAction: "none", cursor }}
    >
      <canvas
        ref={terrainRef}
        aria-hidden="true"
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: bucket,
          height: bucket,
          transform: terrainCanvasTransform(initialVp, bucket),
        }}
      />
      {uploadedMap && uploadedMap.status !== "ready" ? (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center p-2">
          <span className="rounded-md border border-warn/40 bg-bg-1/95 px-3 py-1.5 text-sm text-fg">
            Commander&apos;s map not received — showing the schematic map.{" "}
            <button
              type="button"
              className="font-semibold text-accent underline"
              onClick={() => useRoomStore.getState().requestMap()}
            >
              Request again
            </button>
          </span>
        </div>
      ) : null}
      <svg
        id="map"
        ref={svgRef}
        role="application"
        aria-label={`Tactical map, ${settings.mapSource.kind === "upload" ? settings.mapSource.name : (mapDef?.name ?? settings.map)}`}
        aria-describedby="map-help"
        tabIndex={0}
        className="absolute inset-0 h-full w-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => sendCursor(null)}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (e.target === e.currentTarget) {
            setMapFocused(true);
            if (!crosshair) setCrosshair(viewportCentre(vpRef.current, boxSize.current));
          }
        }}
        onBlur={(e) => {
          if (e.target === e.currentTarget) setMapFocused(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Scene
          state={state}
          nodes={nodes}
          viewport={initialVp}
          zone={zone}
          widthMetres={widthMetres}
          showGrid={grid}
          subgrid={subgrid}
          dimLayers={dimLayers}
          freshIds={freshIds}
          selectedNode={selectedNode}
          highlightId={highlightId}
          editingId={textEditor?.nodeId ?? null}
          pings={pings}
          presence={presence}
          roster={state.roster}
          self={identity.client}
          showCursors={!brief && mode !== "demo"}
          toolPreview={toolPreview ?? kbPreview}
          reducedMotion={reducedMotion}
          worldRef={worldRef}
          pinnedRequests={pinned}
        />
        {crosshair && mapFocused ? (
          <g data-export="skip" pointerEvents="none">
            <g data-screen="" style={{ transform: screenTransform(crosshair) }}>
              <circle
                cx={0}
                cy={0}
                r={10}
                fill="none"
                stroke={TOKEN_HEX.accent}
                strokeWidth={1.5}
              />
              <path
                d="M-16 0 H-6 M6 0 H16 M0 -16 V-6 M0 6 V16"
                stroke={TOKEN_HEX.accent}
                strokeWidth={1.5}
                fill="none"
              />
              <text
                x={0}
                y={-20}
                textAnchor="middle"
                fontFamily="JetBrains Mono, ui-monospace, monospace"
                fontSize={10}
                fontWeight={700}
                fill={TOKEN_HEX.accent}
                stroke={TOKEN_HEX.bg0}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {gridRef(crosshair, true)}
              </text>
            </g>
            {kb.points.map((p, i) => (
              <g key={i} data-screen="" style={{ transform: screenTransform(p) }}>
                <circle cx={0} cy={0} r={3} fill={inkHex(ink)} />
              </g>
            ))}
          </g>
        ) : null}
        {textEditor ? (
          <TextEditor
            key={`${textEditor.nodeId ?? "new"}-${textEditor.at.x}-${textEditor.at.y}`}
            at={textEditor.at}
            kind={textEditor.kind}
            initial={textEditor.initial}
            onCommit={(value) => {
              uiSet({ textEditor: null });
              if (textEditor.nodeId) renameNode(textEditor.nodeId, value);
              else addText(textEditor.at, value);
              svgRef.current?.focus({ preventScroll: true });
            }}
            onCancel={() => {
              uiSet({ textEditor: null });
              svgRef.current?.focus({ preventScroll: true });
            }}
          />
        ) : null}
      </svg>
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ width: box.w || "100%", height: box.h || "100%" }}
      />
      <p id="map-help" className="sr-only">
        Arrow keys pan, plus and minus zoom, Enter places the selected marker at the crosshair, Tab
        moves to the list of things on the map. Press question mark for all shortcuts.
      </p>
    </div>
  );
}
