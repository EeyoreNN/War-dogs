"use client";

// Under 768 px (§4.3.8): the map fills the viewport; a 56 px bottom toolbar (Select, Pen, Arrow,
// Marker, More), Ping and Request FABs, and the panels bottom sheet with Requests / Roster tabs.
import * as React from "react";
import {
  ArrowUpRight,
  Crosshair,
  Ellipsis,
  MapPin,
  MousePointer2,
  Package,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Tabs } from "@/components/ui/tabs";
import { canDraw } from "@/lib/map/roster";
import { MARKER_KINDS, MARKER_META, type MarkerKind } from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { selectMe, useRoomStore } from "@/store/room";
import { placeMarker } from "../actions";
import { paletteHex } from "../lib/palette";
import { MarkerGlyph } from "../MarkerSprite";
import { NodeList } from "../NodeList";
import { RequestsPanel } from "../RequestsPanel";
import { RosterPanel } from "../RosterPanel";
import { useRovingToolbar } from "../ToolRail";
import { useUiStore } from "../ui-store";
import { MoreSheetBody } from "./MoreSheet";

export const MOBILE_BAR_PX = 56;
export const SHEET_PEEK_PX = 56;

export function MobileBar() {
  const tool = useRoomStore((s) => s.tool);
  const setTool = useRoomStore((s) => s.setTool);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const me = useRoomStore(selectMe);
  const uiSet = useUiStore((s) => s.set);
  const moreOpen = useUiStore((s) => s.moreOpen);
  const markerSheet = useUiStore((s) => s.markerSheet);
  const { ref, onKeyDown } = useRovingToolbar("horizontal");
  const allowed = settings ? canDraw(me, settings) : false;

  const item = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    active: boolean,
    disabled = false,
  ) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-fg-muted disabled:opacity-40",
        active && "bg-accent-soft text-accent",
      )}
    >
      {icon}
      <span className="font-mono text-[9px] tracking-[0.08em] uppercase">{label}</span>
    </button>
  );

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      data-mobile-bar=""
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center gap-1 border-t border-line bg-bg-1 px-2"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        height: `calc(${MOBILE_BAR_PX}px + env(safe-area-inset-bottom))`,
      }}
    >
      {item(
        "Select",
        <MousePointer2 size={20} aria-hidden="true" />,
        () => setTool("select"),
        tool === "select",
      )}
      {item(
        "Pen",
        <PenLine size={20} aria-hidden="true" />,
        () => setTool("pen"),
        tool === "pen",
        !allowed,
      )}
      {item(
        "Arrow",
        <ArrowUpRight size={20} aria-hidden="true" />,
        () => setTool("arrow"),
        tool === "arrow",
        !allowed,
      )}
      {item(
        "Marker",
        <MapPin size={20} aria-hidden="true" />,
        () => uiSet({ markerSheet: { at: null } }),
        tool === "marker" || markerSheet !== null,
        !allowed,
      )}
      {item(
        "More",
        <Ellipsis size={20} aria-hidden="true" />,
        () => uiSet({ moreOpen: !moreOpen }),
        moreOpen,
      )}
    </div>
  );
}

export function Fabs({ bottomPx }: { bottomPx: number }) {
  const uiSet = useUiStore((s) => s.set);
  const pingArmed = useUiStore((s) => s.pingArmed);
  return (
    <div
      className="fixed right-3 z-50 flex flex-col gap-3"
      style={{ bottom: `calc(${bottomPx}px + env(safe-area-inset-bottom))` }}
    >
      <Button
        variant="secondary"
        aria-label="Ping"
        aria-pressed={pingArmed}
        data-testid="fab-ping"
        onClick={() => uiSet({ pingArmed: !pingArmed })}
        className={cn(
          "h-12 w-12 rounded-full p-0 shadow-panel",
          pingArmed && "border-accent bg-accent-soft text-accent",
        )}
      >
        <Crosshair size={20} aria-hidden="true" />
      </Button>
      <Button
        aria-label="Request"
        data-testid="fab-request"
        onClick={() => uiSet({ newRequestOpen: true })}
        className="h-12 w-12 rounded-full p-0 shadow-panel"
      >
        <Package size={20} aria-hidden="true" />
      </Button>
    </div>
  );
}

const SNAP_H: Record<"peek" | "half" | "full", string> = {
  peek: "3.5rem",
  half: "50dvh",
  full: "90dvh",
};

export function PanelsSheet() {
  const tab = useUiStore((s) => s.panelTab);
  const snap = useUiStore((s) => s.sheetSnap);
  const uiSet = useUiStore((s) => s.set);
  const requests = useRoomStore((s) => s.state?.requests);
  const roster = useRoomStore((s) => s.state?.roster);
  const openCount = Object.values(requests ?? {}).filter((r) => r.status !== "delivered").length;
  const rosterCount = Object.keys(roster ?? {}).length;
  return (
    // A transformed, sized container turns the primitive's `fixed bottom-0` into "above the bottom bar" (§4.3.8 stacking table).
    <div
      data-panels-sheet=""
      className="fixed inset-x-0 z-40 transform-gpu"
      style={{
        bottom: `calc(${MOBILE_BAR_PX}px + env(safe-area-inset-bottom))`,
        height: SNAP_H[snap],
      }}
    >
      <Sheet
        open
        side="bottom"
        title={tab === "requests" ? "Requests" : "Roster"}
        snap={snap}
        onSnap={(s) => uiSet({ sheetSnap: s })}
        handleBadge={tab === "requests" ? openCount : rosterCount}
        onClose={() => uiSet({ sheetSnap: "peek" })}
      >
        <div className="flex h-full flex-col">
          <Tabs
            aria-label="Panels"
            value={tab}
            onChange={(v) =>
              uiSet({
                panelTab: v as "requests" | "roster",
                sheetSnap: snap === "peek" ? "half" : snap,
              })
            }
            className="shrink-0 px-2"
            items={[
              { value: "requests", label: "Requests", badge: openCount },
              { value: "roster", label: "Roster", badge: rosterCount },
            ]}
          />
          <div className="flex min-h-0 flex-1 flex-col" hidden={tab !== "requests"}>
            <RequestsPanel inSheet />
          </div>
          <div className="flex min-h-0 flex-1 flex-col" hidden={tab !== "roster"}>
            <RosterPanel inSheet />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export function MarkerSheet() {
  const markerSheet = useUiStore((s) => s.markerSheet);
  const uiSet = useUiStore((s) => s.set);
  const setTool = useRoomStore((s) => s.setTool);
  const setMarkerKind = useRoomStore((s) => s.setMarkerKind);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const enemyTeam = useRoomStore((s) => s.enemyTeam);
  if (!markerSheet || !settings) return null;
  const pick = (kind: MarkerKind) => {
    setMarkerKind(kind);
    if (markerSheet.at) placeMarker(markerSheet.at, kind);
    else setTool("marker");
    uiSet({ markerSheet: null });
  };
  return (
    <Sheet
      open
      side="bottom"
      modal
      title={markerSheet.at ? "Place a marker here" : "Markers"}
      snap="half"
      onClose={() => uiSet({ markerSheet: null })}
    >
      <div className="grid grid-cols-4 gap-2 p-4">
        {MARKER_KINDS.map((kind) => {
          const meta = MARKER_META[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-label={meta.label}
              onClick={() => pick(kind)}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-md border border-line-strong bg-bg-2 text-fg"
            >
              <MarkerGlyph
                kind={kind}
                color={paletteHex(kind, settings.team, enemyTeam)}
                size={28}
              />
              <span className="font-mono text-[10px] tracking-[0.08em] text-fg-muted uppercase">
                {meta.short}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function MoreSheet() {
  const moreOpen = useUiStore((s) => s.moreOpen);
  const uiSet = useUiStore((s) => s.set);
  if (!moreOpen) return null;
  return (
    <Sheet
      open
      side="bottom"
      modal
      title="More"
      snap="full"
      onClose={() => uiSet({ moreOpen: false })}
    >
      <MoreSheetBody />
      <NodeList className="mt-4" />
    </Sheet>
  );
}
