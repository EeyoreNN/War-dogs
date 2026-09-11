"use client";

// The war room app root (§3.13, §4.3): boot, identity, layout for desktop / mobile / brief,
// global hotkeys, announcements, the demo director and every dialog. Never imported by a server
// component — MapAppLoader pulls it in with `ssr: false`.
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { announce } from "@/components/ui/live-region";
import { canDraw, isCommand } from "@/lib/map/roster";
import { CallsignSchema } from "@/lib/map/schema";
import type { Identity } from "@/lib/map/types";
import { site } from "@/config/site";
import { generateCallsign, loadIdentity, saveIdentity } from "@/lib/storage/identity";
import { KEY_PREFS } from "@/lib/storage/keys";
import { readJson } from "@/lib/storage/local";
import { selectMe, useRoomStore } from "@/store/room";
import { JoinDialog, SquadPickDialog, StateDialogs } from "./AppDialogs";
import { MapAppContext, useMediaQuery, type MapAppContextValue } from "./context";
import { DemoBar } from "./demo/DemoBar";
import { useDemoDirector } from "./demo/useDemoDirector";
import { HelpDialog } from "./HelpDialog";
import { diffAnnouncements } from "./lib/announcer";
import { playClick } from "./lib/download";
import { isTypingTarget, markerForDigit, toolForKey } from "./lib/keymap";
import { ManageDialog } from "./ManageDialog";
import { MapSurface } from "./MapSurface";
import {
  Fabs,
  MarkerSheet,
  MobileBar,
  MoreSheet,
  PanelsSheet,
  MOBILE_BAR_PX,
  SHEET_PEEK_PX,
} from "./mobile/MobileChrome";
import { NewRequestDialog } from "./NewRequestDialog";
import { NodeList } from "./NodeList";
import { RequestsPanel } from "./RequestsPanel";
import { RosterPanel } from "./RosterPanel";
import { SyncPill } from "./SyncPill";
import { ToolRail } from "./ToolRail";
import { TopBar, useCopyLink } from "./TopBar";
import { selectModalOpen, useUiStore } from "./ui-store";
import { BottomChrome, toggleFullscreen, ZoomStack } from "./ZoomStack";
import { updateMember } from "./actions";

export interface MapAppProps {
  mode: "room" | "demo" | "activity";
  code: string;
  joinHint?: { team?: string; squad?: string };
  activity?: { openExternal: (url: string) => void };
  onReady?: () => void;
}

const KEYFRAMES = `
@keyframes wd-ink-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes wd-drop { from { transform: scale(0.6); opacity: 0.4 } to { transform: scale(1); opacity: 1 } }
@keyframes wd-drop-ring { from { transform: scale(0.6); opacity: 0.9 } to { transform: scale(2); opacity: 0 } }
@keyframes wd-ping { 0% { transform: scale(0.4); opacity: 1 } 100% { transform: scale(1.6); opacity: 0 } }
`;

const TEAMS: readonly string[] = site.game.teams;

/** The per-browser identity; the demo mints an `Operator XXXX` callsign silently (§4.2). */
function initialIdentity(mode: MapAppProps["mode"]): Identity {
  const id = loadIdentity();
  if (mode === "demo" && !id.callsign) {
    const fresh = { ...id, callsign: generateCallsign() };
    saveIdentity(fresh);
    return fresh;
  }
  return id;
}

function readJoinHint(): { team?: string; squad?: string } | null {
  const q = new URLSearchParams(window.location.search);
  const t = q.get("t");
  const s = q.get("s");
  const team = t ? TEAMS.find((x) => x.toLowerCase() === t.toLowerCase()) : undefined;
  if (!team && !s) return null;
  return { ...(team ? { team } : {}), ...(s ? { squad: s.slice(0, 16) } : {}) };
}

export default function MapApp(props: MapAppProps) {
  const { mode, code, activity, onReady } = props;
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const landscapePhone = useMediaQuery("(max-height: 480px) and (orientation: landscape)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // MapApp is client-only (§3.13), so identity and the join hint can come from lazy initialisers.
  const [identity, setIdentity] = React.useState<Identity>(() => initialIdentity(mode));
  const [needJoin, setNeedJoin] = React.useState(
    () => mode !== "demo" && !CallsignSchema.safeParse(initialIdentity(mode).callsign).success,
  );
  const [joinHint, setJoinHint] = React.useState<{ team?: string; squad?: string } | null>(
    () => props.joinHint ?? (mode === "room" ? readJoinHint() : null),
  );
  const [joinSquads, setJoinSquads] = React.useState<string[] | null>(null);
  const booted = useRoomStore((s) => s.code === code);
  const state = useRoomStore((s) => s.state);
  const me = useRoomStore(selectMe);
  const brief = useRoomStore((s) => s.brief);
  const setBrief = useRoomStore((s) => s.setBrief);
  const panelsOpen = useUiStore((s) => s.panelsOpen);
  const sheetSnap = useUiStore((s) => s.sheetSnap);
  const uiSet = useUiStore((s) => s.set);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount, by contract
  }, []);

  // 2–7) Boot the store (rooms and the activity); the demo director boots the demo.
  React.useEffect(() => {
    if (!identity || needJoin || mode === "demo") return;
    const store = useRoomStore.getState();
    void store.boot({ code, mode, identity, joinHint: joinHint ?? undefined });
    return () => {
      useRoomStore.getState().leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per identity / code
  }, [identity, needJoin, code, mode]);
  useDemoDirector(identity, mode === "demo" && !needJoin);

  // Squad from the join link once the room's settings are known.
  React.useEffect(() => {
    if (!state || !me || !joinHint?.squad || !state.settings.squadMode) return;
    if (!me.squad && state.settings.squads.includes(joinHint.squad))
      updateMember(me.id, { squad: joinHint.squad });
  }, [state, me, joinHint]);

  // Brief mode defaults ON under 768 px for members, remembered in prefs (§4.3.8).
  const briefDefaulted = React.useRef(false);
  React.useEffect(() => {
    if (briefDefaulted.current || !isMobile || !me || me.role !== "member" || mode === "demo")
      return;
    briefDefaulted.current = true;
    const raw = readJson<{ brief?: unknown }>(KEY_PREFS);
    if (raw?.brief === undefined) setBrief(true);
  }, [isMobile, me, mode, setBrief]);

  // Announcements and the request click (§4.3.4).
  React.useEffect(() => {
    let prev = useRoomStore.getState();
    return useRoomStore.subscribe((next) => {
      const before = prev;
      prev = next;
      if (before.state === next.state || !next.me) return;
      for (const line of diffAnnouncements(before.state, next.state, next.me.client))
        announce(line);
      if (next.sound && before.state && next.state) {
        for (const r of Object.values(next.state.requests)) {
          if (!before.state.requests[r.id] && r.by !== next.me.client) {
            playClick();
            break;
          }
        }
      }
    });
  }, []);

  // Fullscreen state.
  React.useEffect(() => {
    const onChange = () => uiSet({ fullscreen: !!document.fullscreenElement });
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [uiSet]);

  const rejoin = React.useCallback(() => {
    useRoomStore.getState().leave();
    setNeedJoin(true);
  }, []);

  const ctx = React.useMemo<MapAppContextValue>(
    () => ({
      mode,
      code,
      activity: activity ?? null,
      go: (href) => {
        if (mode === "activity") return;
        router.push(href);
      },
      openExternal: (url) => {
        if (activity) activity.openExternal(url);
        else window.open(url, "_blank", "noopener,noreferrer");
      },
      isMobile,
      landscapePhone,
      reducedMotion,
      rejoin,
      joinHint,
    }),
    [mode, code, activity, router, isMobile, landscapePhone, reducedMotion, rejoin, joinHint],
  );

  useHotkeys(ctx);

  const settings = state?.settings ?? null;
  const drawAllowed = settings ? canDraw(me, settings) : false;
  const showRail = !isMobile || landscapePhone;
  const sheetPx = sheetSnap === "peek" ? SHEET_PEEK_PX : 0;
  const fabBottom = isMobile
    ? sheetSnap === "full"
      ? -200
      : sheetSnap === "half"
        ? MOBILE_BAR_PX + 12
        : MOBILE_BAR_PX + sheetPx + 12
    : 16;

  return (
    <MapAppContext.Provider value={ctx}>
      <div
        ref={rootRef}
        data-bundle="wd:map-app"
        data-mode={mode}
        data-brief={brief || undefined}
        className="relative flex h-dvh flex-col overflow-hidden bg-bg-0 text-fg"
      >
        <style>{KEYFRAMES}</style>
        {state && identity ? (
          <>
            <TopBar />
            <div
              className="flex min-h-0 flex-1"
              style={
                isMobile && !brief && !landscapePhone
                  ? { paddingBottom: `calc(${MOBILE_BAR_PX}px + env(safe-area-inset-bottom))` }
                  : undefined
              }
            >
              {showRail && !brief ? <ToolRail compact={landscapePhone} /> : null}
              <div className="relative min-w-0 flex-1">
                <MapSurface />
                {!isMobile ? (
                  <>
                    <div className="pointer-events-none absolute right-2 bottom-12 flex flex-col items-end gap-2">
                      {mode === "demo" ? <DemoBar /> : null}
                      {!brief ? <ZoomStack className="pointer-events-auto" /> : null}
                    </div>
                    {!brief ? <BottomChrome /> : null}
                    {mode === "demo" && brief ? <SchematicNote /> : null}
                    {!panelsOpen && !brief ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => uiSet({ panelsOpen: true })}
                        className="absolute top-2 right-2 gap-1"
                        aria-label="Show panels"
                      >
                        <ChevronsLeft size={14} aria-hidden="true" /> Panels
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>{mode === "demo" && sheetSnap === "peek" ? <SchematicNote mobile /> : null}</>
                )}
                {brief ? (
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                    <Button
                      variant="chip"
                      onClick={() => setBrief(false)}
                      className="gap-1.5 bg-bg-1/90 backdrop-blur"
                    >
                      <Eye size={13} aria-hidden="true" /> Exit brief
                    </Button>
                    {isMobile ? <SyncPill compact /> : null}
                  </div>
                ) : null}
              </div>
              {!isMobile && !brief && panelsOpen ? (
                <aside
                  aria-label="Panels"
                  className="flex w-80 shrink-0 flex-col border-l border-line bg-bg-1"
                >
                  <RequestsPanel />
                  <RosterPanel />
                  <NodeList />
                </aside>
              ) : null}
            </div>
            {isMobile && !brief && !landscapePhone ? (
              <>
                <MobileBar />
                <PanelsSheet />
              </>
            ) : null}
            {isMobile ? (
              <>
                <MarkerSheet />
                <MoreSheet />
              </>
            ) : null}
            {isMobile || brief ? <Fabs bottomPx={brief && !isMobile ? 16 : fabBottom} /> : null}
            <NewRequestDialog />
            <HelpDialog />
            {isCommand(me) && mode !== "demo" ? <ManageDialog /> : null}
            <SquadPickDialog />
            <StateDialogs />
            {!drawAllowed && settings?.drawAccess === "request" && isMobile ? (
              <span className="sr-only">Drawing needs the commander&apos;s approval.</span>
            ) : null}
          </>
        ) : booted || mode === "demo" ? (
          <div className="flex flex-1 flex-col">
            <div className="h-11 border-b border-line bg-bg-1 md:h-12" />
            <StateDialogs />
          </div>
        ) : null}
        {identity && needJoin ? (
          <JoinDialog
            open
            code={code}
            identity={identity}
            squads={joinSquads}
            activityCopy={mode === "activity"}
            onJoin={(next, squad) => {
              saveIdentity(next);
              setIdentity(next);
              setNeedJoin(false);
              if (squad) setJoinHint((h) => ({ ...(h ?? {}), squad }));
              setJoinSquads(null);
            }}
          />
        ) : null}
      </div>
    </MapAppContext.Provider>
  );
}

function SchematicNote({ mobile = false }: { mobile?: boolean }) {
  return (
    <p
      className="pointer-events-none absolute left-2 z-10 rounded-sm bg-bg-0/70 px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-fg-muted uppercase backdrop-blur"
      style={mobile ? { bottom: `calc(${SHEET_PEEK_PX}px + 8px)` } : { bottom: 8 }}
    >
      Schematic map — layout is approximate.
    </p>
  );
}

/** Global single-key and modifier shortcuts (Appendix A). */
function useHotkeys(ctx: MapAppContextValue) {
  const { copyLink } = useCopyLink(useRoomStore((s) => s.code) ?? "");
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const ui = useUiStore.getState();
      const s = useRoomStore.getState();
      if (!s.state || !s.me) return;
      const member = s.state.roster[s.me.client] ?? null;
      const allowed = canDraw(member, s.state.settings) && !s.brief;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key;
      const lower = k.toLowerCase();
      const mapFocused = document.activeElement?.id === "map";
      if (mod) {
        if (lower === "z") {
          e.preventDefault();
          if (e.shiftKey) s.redo();
          else s.undo();
        } else if (lower === "y" && e.ctrlKey) {
          e.preventDefault();
          s.redo();
        } else if (lower === "c" && !e.shiftKey) {
          if (
            mapFocused &&
            !s.selection &&
            !window.getSelection()?.toString() &&
            ctx.mode !== "activity"
          ) {
            e.preventDefault();
            void copyLink();
          }
        } else if (lower === "e" && e.shiftKey && isCommand(member) && ctx.mode !== "demo") {
          e.preventDefault();
          ui.openManage("plan");
        }
        return;
      }
      if (e.altKey) return;
      if (selectModalOpen(ui)) return;
      if (k === "?") {
        e.preventDefault();
        ui.set({ helpOpen: true });
        return;
      }
      if (k === "Escape") {
        if (ui.pingArmed || ui.placingRequest) ui.set({ pingArmed: false, placingRequest: null });
        else if (ui.layersOpen) ui.set({ layersOpen: false });
        return;
      }
      if (k === "X" && e.shiftKey) {
        e.preventDefault();
        const at = ui.viewportApi?.crosshair();
        if (at) s.ping(at);
        return;
      }
      switch (lower) {
        case "n":
          e.preventDefault();
          ui.set({ newRequestOpen: true });
          return;
        case "x":
          e.preventDefault();
          ui.set({ pingArmed: !ui.pingArmed });
          announce(
            ui.pingArmed ? "Ping tool off" : "Ping tool armed: click the map or press Enter",
          );
          return;
        case "g":
          s.setGrid(!s.grid);
          return;
        case "f":
          toggleFullscreen();
          return;
        case "0":
          ui.viewportApi?.fit();
          return;
        case "+":
        case "=":
          ui.viewportApi?.zoomIn();
          return;
        case "-":
        case "_":
          ui.viewportApi?.zoomOut();
          return;
        case "b":
          s.setBrief(!s.brief);
          announce(s.brief ? "Brief mode off" : "Brief mode on");
          return;
        default:
          break;
      }
      const marker = markerForDigit(k);
      if (marker) {
        if (!allowed) return;
        e.preventDefault();
        s.setMarkerKind(marker);
        s.setTool("marker");
        return;
      }
      const tool = toolForKey(k);
      if (tool) {
        if (tool !== "select" && !allowed) return;
        e.preventDefault();
        s.setTool(tool);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx.mode, copyLink]);
}
