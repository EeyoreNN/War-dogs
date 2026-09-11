// Server-renderable static scene (§3.13): terrain by URL under the same SVG layers the live app
// uses, geometry from fitToBox on a square of `size`, so the live app can replace it in place.
import type * as React from "react";
import { fitToBox } from "@/lib/map/viewport";
import type { RoomState } from "@/lib/map/types";
import { terrainUrl } from "@/lib/terrain/url";
import { mapById } from "@/config/maps";
import { cn } from "@/lib/utils";
import { widthMetresFor, zoneFor } from "./lib/zone";
import { inverseScale } from "./lib/screen";
import { partitionNodes, Scene } from "./Scene";

export function MapPreview({
  state,
  size = 1024,
  showGrid = false,
  priority = false,
  className,
  title,
  fit = "contain",
}: {
  state: RoomState;
  size?: number;
  showGrid?: boolean;
  priority?: boolean;
  className?: string;
  title?: string;
  /** `cover` crops the square map to the box (the 16:10 hero frame). */
  fit?: "contain" | "cover";
}) {
  const viewport = fitToBox({ w: size, h: size });
  const { map, controlZone } = state.settings;
  const mapName = mapById(map)?.name ?? map;
  const zone = state.settings.mapSource.kind === "builtin" ? zoneFor(state.settings) : null;
  const nodes = partitionNodes(state, null);
  const style = { "--inv": String(inverseScale(viewport)) } as React.CSSProperties;
  return (
    <div
      data-map-preview=""
      className={cn(
        "relative overflow-hidden bg-bg-0",
        fit === "contain" ? "aspect-square" : "h-full w-full",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the terrain is an SVG route, not an optimisable raster */}
      <img
        src={terrainUrl(map, { zone: controlZone, size: 1024, labels: true })}
        alt=""
        width={1024}
        height={1024}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        loading={priority ? "eager" : "lazy"}
        draggable={false}
        className={cn(
          "absolute inset-0 h-full w-full select-none",
          fit === "cover" ? "object-cover" : "object-contain",
        )}
      />
      <svg
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio={fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
        role="img"
        aria-label={title ?? `The plan on ${mapName}`}
        className="absolute inset-0 h-full w-full"
        style={style}
      >
        <Scene
          state={state}
          nodes={nodes}
          viewport={viewport}
          zone={zone}
          widthMetres={widthMetresFor(state.settings)}
          showGrid={showGrid}
        />
      </svg>
    </div>
  );
}
