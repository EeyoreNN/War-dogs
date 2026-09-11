"use client";

// The `More` sheet body (§4.3.8): the remaining tools, ink, undo / redo, grid / fit / fullscreen,
// layers, sound, Controls & help, Manage.
import {
  Circle,
  CircleHelp,
  Grid3x3,
  Maximize2,
  Minus,
  Redo2,
  Ruler,
  Scan,
  Settings2,
  Square,
  Type,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { canDraw, isCommand } from "@/lib/map/roster";
import { INK_COLORS, INK_HEX, INK_LABEL, type Tool } from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { selectMe, useRoomStore } from "@/store/room";
import { useMapApp } from "../context";
import { useUiStore } from "../ui-store";
import { toggleFullscreen } from "../ZoomStack";

export function MoreSheetBody() {
  const tool = useRoomStore((s) => s.tool);
  const ink = useRoomStore((s) => s.ink);
  const grid = useRoomStore((s) => s.grid);
  const sound = useRoomStore((s) => s.sound);
  const history = useRoomStore((s) => s.history);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const me = useRoomStore(selectMe);
  const setTool = useRoomStore((s) => s.setTool);
  const setInk = useRoomStore((s) => s.setInk);
  const setGrid = useRoomStore((s) => s.setGrid);
  const setSound = useRoomStore((s) => s.setSound);
  const undo = useRoomStore((s) => s.undo);
  const redo = useRoomStore((s) => s.redo);
  const uiSet = useUiStore((s) => s.set);
  const openManage = useUiStore((s) => s.openManage);
  const api = useUiStore((s) => s.viewportApi);
  const { mode } = useMapApp();
  const allowed = settings ? canDraw(me, settings) : false;

  const tools: { t: Tool; label: string; icon: React.ReactNode }[] = [
    { t: "line", label: "Line", icon: <Minus size={18} aria-hidden="true" /> },
    { t: "circle", label: "Circle", icon: <Circle size={18} aria-hidden="true" /> },
    { t: "rect", label: "Rect", icon: <Square size={18} aria-hidden="true" /> },
    { t: "text", label: "Text", icon: <Type size={18} aria-hidden="true" /> },
    { t: "measure", label: "Measure", icon: <Ruler size={18} aria-hidden="true" /> },
  ];
  const close = () => uiSet({ moreOpen: false });
  const cell =
    "flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-line-strong bg-bg-2 text-[11px] font-semibold text-fg disabled:opacity-40 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent";

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <p className="mb-2 label-mono">Tools</p>
        <div className="grid grid-cols-5 gap-2">
          {tools.map((x) => (
            <button
              key={x.t}
              type="button"
              aria-pressed={tool === x.t}
              disabled={!allowed}
              onClick={() => {
                setTool(x.t);
                close();
              }}
              className={cell}
            >
              {x.icon}
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 label-mono">Ink</p>
        <div role="radiogroup" aria-label="Ink colour" className="flex gap-2">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={ink === c}
              aria-label={INK_LABEL[c]}
              disabled={!allowed}
              onClick={() => setInk(c)}
              className="flex h-11 w-11 items-center justify-center rounded-md bg-bg-2 disabled:opacity-40"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-6 w-6 rounded-full",
                  ink === c && "ring-2 ring-fg ring-offset-2 ring-offset-bg-2",
                )}
                style={{ background: INK_HEX[c] }}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 label-mono">View</p>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!history.undo.length}
            className={cell}
            aria-label="Undo"
          >
            <Undo2 size={18} aria-hidden="true" />
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!history.redo.length}
            className={cell}
            aria-label="Redo"
          >
            <Redo2 size={18} aria-hidden="true" />
            Redo
          </button>
          <button type="button" aria-pressed={grid} onClick={() => setGrid(!grid)} className={cell}>
            <Grid3x3 size={18} aria-hidden="true" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => {
              api?.fit();
              close();
            }}
            className={cell}
          >
            <Scan size={18} aria-hidden="true" />
            Fit
          </button>
          <button
            type="button"
            onClick={() => {
              toggleFullscreen();
              close();
            }}
            className={cell}
          >
            <Maximize2 size={18} aria-hidden="true" />
            Full
          </button>
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => setSound(!sound)}
            className={cell}
          >
            {sound ? (
              <Volume2 size={18} aria-hidden="true" />
            ) : (
              <VolumeX size={18} aria-hidden="true" />
            )}
            Sound
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              uiSet({ helpOpen: true });
            }}
            className={cell}
          >
            <CircleHelp size={18} aria-hidden="true" />
            Help
          </button>
          {isCommand(me) && mode !== "demo" ? (
            <button
              type="button"
              onClick={() => {
                close();
                openManage();
              }}
              className={cell}
            >
              <Settings2 size={18} aria-hidden="true" />
              Manage
            </button>
          ) : null}
        </div>
      </div>
      {mode === "demo" ? (
        <Button
          variant="secondary"
          onClick={() => {
            useRoomStore.getState().clearMine();
            close();
          }}
        >
          Clear mine
        </Button>
      ) : null}
    </div>
  );
}
