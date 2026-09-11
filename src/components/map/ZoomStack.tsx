"use client";

// Bottom-right zoom stack (§4.3.2): + − fit fullscreen grid ping layers; bottom bar: sound, OUR
// DISCORD, CONTROLS & HELP; bottom-left: version + Schematic map note.
import * as React from "react";
import {
  Crosshair,
  Grid3x3,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Scan,
  Volume2,
  VolumeX,
  CircleHelp,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { DiscordIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { isCommand } from "@/lib/map/roster";
import { cn } from "@/lib/utils";
import { selectMe, useRoomStore } from "@/store/room";
import { useMapApp } from "./context";
import { useUiStore } from "./ui-store";

export function ZoomStack({ className }: { className?: string }) {
  const grid = useRoomStore((s) => s.grid);
  const setGrid = useRoomStore((s) => s.setGrid);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const me = useRoomStore(selectMe);
  const pingArmed = useUiStore((s) => s.pingArmed);
  const fullscreen = useUiStore((s) => s.fullscreen);
  const layersOpen = useUiStore((s) => s.layersOpen);
  const hiddenLayers = useUiStore((s) => s.hiddenLayers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);
  const uiSet = useUiStore((s) => s.set);
  const api = useUiStore((s) => s.viewportApi);

  const btn = (
    label: string,
    kbd: string,
    icon: React.ReactNode,
    onClick: () => void,
    extra?: { active?: boolean; testId?: string },
  ) => (
    <Tooltip label={`${label} — ${kbd}`} side="left">
      <Button
        variant="icon"
        size="icon"
        aria-label={label}
        aria-keyshortcuts={kbd}
        active={extra?.active}
        data-testid={extra?.testId}
        onClick={onClick}
      >
        {icon}
      </Button>
    </Tooltip>
  );

  const squads = settings?.squadMode ? settings.squads : [];
  const mySquad = me?.squad;

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      {layersOpen && settings?.squadMode ? (
        <div
          role="group"
          aria-label="Layers"
          className="mb-1 w-44 rounded-md border border-line-strong bg-bg-1/95 p-2 shadow-panel backdrop-blur"
        >
          {["team", ...squads.map((q) => `squad:${q}`)].map((layer) => (
            <label
              key={layer}
              className="flex h-8 cursor-pointer items-center gap-2 px-1 text-sm text-fg"
            >
              <input
                type="checkbox"
                checked={!hiddenLayers.includes(layer)}
                onChange={() => toggleLayer(layer)}
                className="accent-[var(--accent)]"
              />
              {layer === "team" ? "Team map" : layer.slice(6)}
            </label>
          ))}
          {mySquad || isCommand(me) ? (
            <Button
              variant="chip"
              className="mt-1 w-full"
              onClick={() => {
                const keep = mySquad ? `squad:${mySquad}` : "team";
                uiSet({
                  hiddenLayers: ["team", ...squads.map((q) => `squad:${q}`)].filter(
                    (l) => l !== keep,
                  ),
                });
              }}
            >
              Focus my squad
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        className="flex flex-col rounded-md border border-line-strong bg-bg-1/95 p-0.5 shadow-panel backdrop-blur"
        role="group"
        aria-label="View"
      >
        {btn("Zoom in", "+", <Plus size={18} aria-hidden="true" />, () => api?.zoomIn())}
        {btn("Zoom out", "−", <Minus size={18} aria-hidden="true" />, () => api?.zoomOut())}
        {btn("Fit map", "0", <Scan size={18} aria-hidden="true" />, () => api?.fit())}
        {btn(
          fullscreen ? "Exit fullscreen" : "Fullscreen",
          "F",
          fullscreen ? (
            <Minimize2 size={18} aria-hidden="true" />
          ) : (
            <Maximize2 size={18} aria-hidden="true" />
          ),
          () => toggleFullscreen(),
        )}
        <div className="my-0.5 h-px bg-line-strong" />
        {btn("Grid", "G", <Grid3x3 size={18} aria-hidden="true" />, () => setGrid(!grid), {
          active: grid,
        })}
        {btn(
          "Ping tool",
          "X",
          <Crosshair size={18} aria-hidden="true" />,
          () => uiSet({ pingArmed: !pingArmed }),
          { active: pingArmed, testId: "ping-tool" },
        )}
        {settings?.squadMode
          ? btn(
              "Layers",
              "",
              <Layers size={18} aria-hidden="true" />,
              () => uiSet({ layersOpen: !layersOpen }),
              { active: layersOpen },
            )
          : null}
      </div>
    </div>
  );
}

export function toggleFullscreen(): void {
  const root =
    document.querySelector<HTMLElement>("[data-bundle='wd:map-app']") ?? document.documentElement;
  if (document.fullscreenElement) void document.exitFullscreen?.();
  else void root.requestFullscreen?.().catch(() => undefined);
}

export function BottomChrome() {
  const sound = useRoomStore((s) => s.sound);
  const setSound = useRoomStore((s) => s.setSound);
  const uiSet = useUiStore((s) => s.set);
  const { openExternal, mode } = useMapApp();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-bg-0/70 px-2 py-1 font-mono text-[10px] tracking-[0.12em] whitespace-nowrap text-fg-muted uppercase backdrop-blur">
        <span>v{site.version}</span>
        <span aria-hidden="true">·</span>
        {mode === "demo" ? (
          <span>Schematic map — layout is approximate.</span>
        ) : (
          <Tooltip
            label="Layout is approximate. Commanders can upload a real map under Manage."
            side="top"
          >
            <button type="button" className="inline-flex items-center gap-1 rounded-sm">
              Schematic map <Info size={11} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="pointer-events-auto flex items-center gap-1.5">
        <Tooltip label={sound ? "Sound on — click on new requests" : "Sound off"} side="top">
          <Button
            variant="icon"
            size="icon"
            active={sound}
            aria-label="Sound on new requests"
            onClick={() => setSound(!sound)}
            className="bg-bg-1/90 backdrop-blur"
          >
            {sound ? (
              <Volume2 size={18} aria-hidden="true" />
            ) : (
              <VolumeX size={18} aria-hidden="true" />
            )}
          </Button>
        </Tooltip>
        <Button
          variant="chip"
          className="gap-1.5 bg-bg-1/90 backdrop-blur"
          onClick={() => openExternal(site.links.discord)}
        >
          <DiscordIcon size={13} className="text-[#5865F2]" />
          Our Discord
        </Button>
        <Button
          variant="chip"
          className="gap-1.5 bg-bg-1/90 backdrop-blur"
          onClick={() => uiSet({ helpOpen: true })}
          aria-keyshortcuts="?"
        >
          <CircleHelp size={13} aria-hidden="true" />
          Controls &amp; help
        </Button>
      </div>
    </div>
  );
}
