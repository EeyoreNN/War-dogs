"use client";

// The 80 px tool rail (§4.3.2): a vertical roving toolbar of 40 px icon buttons, ink swatches,
// and the three marker palettes (FRIENDLY / ENEMY with the faction toggle / MARK).
import * as React from "react";
import {
  ArrowUpRight,
  Circle,
  Lock,
  Minus,
  MousePointer2,
  PenLine,
  Redo2,
  Ruler,
  Square,
  Type,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { site } from "@/config/site";
import { enemyTeams } from "@/lib/map/teams";
import { canDraw } from "@/lib/map/roster";
import {
  INK_COLORS,
  INK_HEX,
  INK_LABEL,
  MARKER_KINDS,
  MARKER_META,
  type MarkerKind,
  type Tool,
} from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { selectMe, useRoomStore } from "@/store/room";
import { askToDraw } from "./actions";
import { TOOL_HOTKEY } from "./lib/keymap";
import { paletteHex } from "./lib/palette";
import { MarkerGlyph } from "./MarkerSprite";

const TOOL_ICON: Record<
  keyof typeof TOOL_HOTKEY,
  React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>
> = {
  select: MousePointer2,
  pen: PenLine,
  arrow: ArrowUpRight,
  line: Minus,
  circle: Circle,
  rect: Square,
  text: Type,
  measure: Ruler,
};

const GROUPS: (keyof typeof TOOL_HOTKEY)[][] = [
  ["select", "pen", "arrow", "line", "circle", "rect", "text"],
  ["measure"],
];

const TEAM_DOT: Record<string, string> = {
  Lonestar: "bg-lonestar",
  Valkyra: "bg-valkyra",
  Manticore: "bg-manticore",
};

/** Roving tabindex over every button in the rail: arrows move, Home/End jump. */
export function useRovingToolbar(orientation: "vertical" | "horizontal") {
  const ref = React.useRef<HTMLDivElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = ref.current;
    if (!el) return;
    const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
    const prev = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
    if (![next, prev, "Home", "End"].includes(e.key)) return;
    const items = Array.from(
      el.querySelectorAll<HTMLElement>('button:not([disabled]), [role="radio"]:not([disabled])'),
    );
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let n = i;
    if (e.key === next) n = (i + 1) % items.length;
    else if (e.key === prev) n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else n = items.length - 1;
    e.preventDefault();
    items.forEach((it, k) => it.setAttribute("tabindex", k === n ? "0" : "-1"));
    items[n].focus();
  };
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = Array.from(
      el.querySelectorAll<HTMLElement>('button:not([disabled]), [role="radio"]:not([disabled])'),
    );
    if (!items.some((it) => it.getAttribute("tabindex") === "0"))
      items.forEach((it, k) => it.setAttribute("tabindex", k === 0 ? "0" : "-1"));
  });
  return { ref, onKeyDown };
}

export function ToolRail({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const tool = useRoomStore((s) => s.tool);
  const ink = useRoomStore((s) => s.ink);
  const markerKind = useRoomStore((s) => s.markerKind);
  const enemyTeam = useRoomStore((s) => s.enemyTeam);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const me = useRoomStore(selectMe);
  const history = useRoomStore((s) => s.history);
  const setTool = useRoomStore((s) => s.setTool);
  const setInk = useRoomStore((s) => s.setInk);
  const setMarkerKind = useRoomStore((s) => s.setMarkerKind);
  const setEnemyTeam = useRoomStore((s) => s.setEnemyTeam);
  const undo = useRoomStore((s) => s.undo);
  const redo = useRoomStore((s) => s.redo);
  const { ref, onKeyDown } = useRovingToolbar("vertical");

  const allowed = settings ? canDraw(me, settings) : false;
  const team = settings?.team ?? "Lonestar";
  const enemies = enemyTeams(team);

  const pickMarker = (kind: MarkerKind) => {
    setMarkerKind(kind);
    setTool("marker");
  };

  const toolButton = (t: keyof typeof TOOL_HOTKEY) => {
    const Icon = TOOL_ICON[t];
    const def = TOOL_HOTKEY[t];
    const active = tool === (t as Tool);
    const disabled = !allowed && t !== "select";
    return (
      <Tooltip key={t} label={`${def.label} — ${def.key.toUpperCase()}`} side="right">
        <Button
          variant="icon"
          size="icon"
          active={active}
          disabled={disabled}
          aria-label={def.label}
          aria-keyshortcuts={def.key.toUpperCase()}
          data-tool={t}
          onClick={() => setTool(t as Tool)}
          className="relative"
        >
          <Icon size={18} aria-hidden="true" />
          {disabled ? (
            <Lock size={9} aria-hidden="true" className="absolute right-1 bottom-1" />
          ) : (
            <span
              aria-hidden="true"
              className="absolute right-1 bottom-0.5 font-mono text-[9px] leading-none text-fg-faint"
            >
              {def.key.toUpperCase()}
            </span>
          )}
        </Button>
      </Tooltip>
    );
  };

  const palette = (
    title: string,
    kinds: MarkerKind[],
    header?: React.ReactNode,
    color = "text-fg-muted",
  ) => (
    <div className="flex w-full flex-col items-center gap-1 pt-2">
      <div className={cn("w-full px-1 text-center label-mono", color)}>{title}</div>
      {header}
      <div className="grid grid-cols-2 gap-1">
        {kinds.map((kind) => {
          const meta = MARKER_META[kind];
          const hex = paletteHex(kind, team, enemyTeam);
          const active = tool === "marker" && markerKind === kind;
          return (
            <Tooltip key={kind} label={`${meta.label} — ${meta.hotkey}`} side="right">
              <button
                type="button"
                aria-label={meta.label}
                aria-pressed={active}
                aria-keyshortcuts={meta.hotkey}
                disabled={!allowed}
                data-marker={kind}
                onClick={() => pickMarker(kind)}
                className={cn(
                  "flex h-9 w-9 flex-col items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-2 disabled:opacity-40",
                  active && "bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]",
                )}
              >
                <MarkerGlyph kind={kind} color={hex} size={20} />
                <span
                  aria-hidden="true"
                  className="font-mono text-[8px] leading-none tracking-[0.06em] text-fg-faint"
                >
                  {meta.short}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      data-rail=""
      className={cn(
        "flex w-20 shrink-0 scrollbar-thin flex-col items-center gap-1 overflow-y-auto border-r border-line bg-bg-1",
        compact ? "w-14 py-1" : "py-2",
        className,
      )}
    >
      {GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 ? <div className="my-1 h-px w-10 bg-line-strong" /> : null}
          {group.map(toolButton)}
        </React.Fragment>
      ))}
      <div className="my-1 h-px w-10 bg-line-strong" />
      <div className="flex gap-0">
        <Tooltip label="Undo — Mod+Z" side="right">
          <Button
            variant="icon"
            size="icon"
            aria-label="Undo"
            aria-keyshortcuts="Control+Z Meta+Z"
            disabled={history.undo.length === 0}
            onClick={undo}
            className="h-9 w-9"
          >
            <Undo2 size={16} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip label="Redo — Mod+Shift+Z" side="right">
          <Button
            variant="icon"
            size="icon"
            aria-label="Redo"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            disabled={history.redo.length === 0}
            onClick={redo}
            className="h-9 w-9"
          >
            <Redo2 size={16} aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>
      <div className="my-1 h-px w-10 bg-line-strong" />
      <div className="label-mono">Ink</div>
      <div role="radiogroup" aria-label="Ink colour" className="grid grid-cols-3">
        {INK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={ink === c}
            aria-label={INK_LABEL[c]}
            disabled={!allowed}
            onClick={() => setInk(c)}
            className="flex h-10 w-[22px] items-center justify-center rounded-md hover:bg-bg-2 disabled:opacity-40 sm:w-6"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-5 w-5 rounded-full border border-black/30",
                ink === c && "ring-2 ring-fg ring-offset-2 ring-offset-bg-1",
              )}
              style={{ background: INK_HEX[c] }}
            />
          </button>
        ))}
      </div>
      <div className="my-1 h-px w-10 bg-line-strong" />
      {palette(
        "Friendly",
        ["fob", "rally", "lz", "obj"],
        <div className="flex items-center gap-1 font-mono text-[9px] tracking-[0.1em] text-fg-faint uppercase">
          <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", TEAM_DOT[team])} />
          {team}
        </div>,
        "text-friendly",
      )}
      {palette(
        "Enemy",
        ["enemy-fob", "enemy-troops"],
        <div role="radiogroup" aria-label="Enemy faction" className="flex gap-0.5">
          {enemies.map((t, i) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={enemyTeam === t}
              aria-label={t}
              disabled={!allowed}
              onClick={() => setEnemyTeam(t)}
              className={cn(
                "h-6 rounded-sm px-1 font-mono text-[8px] tracking-[0.06em] uppercase transition-colors disabled:opacity-40",
                i === 0 ? "text-enemy-a" : "text-enemy-b",
                enemyTeam === t
                  ? "bg-bg-2 shadow-[inset_0_0_0_1px_currentColor]"
                  : "text-fg-faint hover:bg-bg-2",
              )}
            >
              {t.slice(0, 4)}
            </button>
          ))}
        </div>,
        "text-enemy-a",
      )}
      {palette("Mark", ["danger", "pin"], undefined, "text-warn")}
      {!allowed && settings?.drawAccess === "request" ? (
        <div className="px-1 pt-3">
          <Button
            variant="chip"
            onClick={askToDraw}
            disabled={me?.drawRequested}
            className="h-7 px-2 text-[10px]"
          >
            {me?.drawRequested ? "Asked" : "Ask to draw"}
          </Button>
        </div>
      ) : null}
      <div className="sticky bottom-0 mt-auto w-full bg-bg-1 pt-2 pb-1 text-center font-mono text-[10px] text-fg-faint">
        v{site.version}
      </div>
      <span className="sr-only">{MARKER_KINDS.length} marker kinds</span>
    </div>
  );
}
