"use client";

// The home hero's live replay (§3.13, §4.1): owns its state, plays HERO_TIMELINE on a loop over
// the demo seed room, renders the live SVG layers (cover-fitted) and a "take over" link to /demo.
import * as React from "react";
import Link from "next/link";
import { applyOp } from "@/lib/map/reduce";
import { HERO_LOOP_MS, HERO_TIMELINE, heroOps, heroStartState } from "@/lib/map/scenario";
import { mapModel } from "@/lib/terrain/generate";
import { terrainBitmap } from "@/lib/terrain/draw-canvas";
import type { Ping, RoomState } from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { HeroChrome } from "./HeroChrome";
import { inverseScale, coverBox, terrainBucket, terrainCanvasTransform } from "./lib/screen";
import { widthMetresFor, zoneFor } from "./lib/zone";
import { partitionNodes, Scene } from "./Scene";

const PING_MS = 4_000;

export default function HeroPlayer({
  className,
  onReady,
}: {
  className?: string;
  onReady?: () => void;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  const [state, setState] = React.useState<RoomState>(() => heroStartState());
  const [pings, setPings] = React.useState<Ping[]>([]);
  const [fresh, setFresh] = React.useState<ReadonlySet<string>>(() => new Set());

  React.useEffect(() => {
    onReady?.();
  }, [onReady]);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const viewport = React.useMemo(() => coverBox(box.w && box.h ? box : { w: 1024, h: 640 }), [box]);
  const bucket = terrainBucket(
    viewport.scale,
    typeof window === "undefined" ? 1 : window.devicePixelRatio,
  );

  // Terrain: drawn once per bucket from the memoised bitmap; the canvas follows the viewport by CSS.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    void terrainBitmap(mapModel(state.settings.map), bucket).then((bmp) => {
      if (cancelled) return;
      canvas.width = bucket;
      canvas.height = bucket;
      canvas.getContext("2d")?.drawImage(bmp, 0, 0, bucket, bucket);
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, state.settings.map]);

  // The loop: every timeline item at its offset, then start again.
  React.useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const ops = heroOps();
    const run = () => {
      if (!alive) return;
      setState(heroStartState());
      setPings([]);
      let opI = 0;
      for (const item of HERO_TIMELINE) {
        if (item.kind === "op") {
          const op = ops[opI++];
          timers.push(
            setTimeout(() => {
              setState((s) => applyOp(s, op));
              if (op.t === "node.add") {
                const ids = op.nodes.map((n) => n.id);
                setFresh(new Set(ids));
                timers.push(setTimeout(() => setFresh(new Set()), 400));
              }
            }, item.at),
          );
        } else {
          timers.push(
            setTimeout(() => {
              const ping: Ping = { ...item.ping, id: `hero-${item.at}`, ts: Date.now() };
              setPings((p) => [...p, ping]);
              timers.push(
                setTimeout(() => setPings((p) => p.filter((x) => x.id !== ping.id)), PING_MS),
              );
            }, item.at),
          );
        }
      }
      timers.push(setTimeout(run, HERO_LOOP_MS));
    };
    run();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      timers = [];
    };
  }, []);

  const nodes = React.useMemo(() => partitionNodes(state, null), [state]);
  const zone = React.useMemo(() => zoneFor(state.settings), [state.settings]);
  const style = { "--inv": String(inverseScale(viewport)) } as React.CSSProperties;

  return (
    <div data-bundle="wd:hero" className={cn("flex h-full w-full flex-col", className)}>
      <HeroChrome />
      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden bg-bg-0">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: bucket,
            height: bucket,
            transform: terrainCanvasTransform(viewport, bucket),
          }}
        />
        <svg
          role="img"
          aria-label="The shared map replaying a demo plan on Zestafona"
          className="absolute inset-0 h-full w-full"
          style={style}
        >
          <Scene
            state={state}
            nodes={nodes}
            viewport={viewport}
            zone={zone}
            widthMetres={widthMetresFor(state.settings)}
            showGrid={false}
            freshIds={fresh}
            pings={pings}
          />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-3">
          <Link
            href="/demo"
            className="pointer-events-auto inline-flex h-8 items-center gap-2 rounded-md border border-line-strong bg-bg-1/90 px-3 font-mono text-[11px] font-medium tracking-[0.14em] text-fg uppercase backdrop-blur hover:border-line-hi hover:bg-bg-2"
          >
            This is the real app — take over →
          </Link>
        </div>
      </div>
    </div>
  );
}
