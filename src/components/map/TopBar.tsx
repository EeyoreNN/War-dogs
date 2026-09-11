"use client";

// The app top bar (§4.3.2, §4.3.8): mark, WAR ROOM, code chip, COPY LINK, MANAGE, map · zone,
// sync pill, Brief toggle, callsign menu, role badge. Container queries collapse it as it
// narrows; nothing wraps and it never scrolls.
import * as React from "react";
import Link from "next/link";
import { Copy, Check, Eye, Settings2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { announce } from "@/components/ui/live-region";
import { LogoMark } from "@/components/ui/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { site } from "@/config/site";
import { mapById } from "@/config/maps";
import { CONTROL_ZONE_LABEL } from "@/lib/terrain/types";
import { isCommand } from "@/lib/map/roster";
import { cn } from "@/lib/utils";
import { selectMe, useRoomStore } from "@/store/room";
import { CallsignMenu } from "./CallsignMenu";
import { useMapApp } from "./context";
import { copyText } from "./lib/download";
import { DemoClock } from "./demo/DemoClock";
import { SyncPill } from "./SyncPill";
import { useUiStore } from "./ui-store";

export function useCopyLink(code: string) {
  const [copied, setCopied] = React.useState(false);
  const uiSet = useUiStore((s) => s.set);
  const link = `${site.url}/join?code=${code}`;
  const copy = React.useCallback(
    async (text: string, label: string) => {
      const ok = await copyText(text);
      if (!ok) {
        uiSet({ copyFallback: { title: "Copy this link", text } });
        return;
      }
      setCopied(true);
      announce(label);
      setTimeout(() => setCopied(false), 2000);
    },
    [uiSet],
  );
  return {
    link,
    copied,
    copyLink: () => copy(link, "Link copied"),
    copyCode: () => copy(code, "Code copied"),
  };
}

export function TopBar() {
  const { mode, isMobile, activity } = useMapApp();
  const code = useRoomStore((s) => s.code) ?? "";
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const me = useRoomStore(selectMe);
  const brief = useRoomStore((s) => s.brief);
  const setBrief = useRoomStore((s) => s.setBrief);
  const openManage = useUiStore((s) => s.openManage);
  const demoChipDismissed = useUiStore((s) => s.demoChipDismissed);
  const uiSet = useUiStore((s) => s.set);
  const { copied, copyLink, copyCode } = useCopyLink(code);
  const [codeFlash, setCodeFlash] = React.useState(false);

  const mapName = settings
    ? settings.mapSource.kind === "upload"
      ? "Custom map"
      : (mapById(settings.map)?.name ?? settings.map)
    : "";
  const zoneName = settings ? CONTROL_ZONE_LABEL[settings.controlZone] : "";
  const centre =
    settings?.mapSource.kind === "upload" ? "CUSTOM MAP" : `${mapName} · ${zoneName}`.toUpperCase();
  const command = isCommand(me);
  const role = me?.role;

  const onCopyCode = async () => {
    await copyCode();
    setCodeFlash(true);
    setTimeout(() => setCodeFlash(false), 600);
  };

  const mark = activity ? (
    <span className="inline-flex" aria-hidden="true">
      <LogoMark size={22} />
    </span>
  ) : (
    <Link
      href="/"
      aria-label={`${site.name} home`}
      className="inline-flex rounded-sm"
      onClick={(e) => {
        if (mode === "activity") e.preventDefault();
      }}
    >
      <LogoMark size={22} />
    </Link>
  );

  if (isMobile) {
    return (
      <header
        className="hud-corners flex h-11 shrink-0 items-center gap-2 border-b border-line bg-bg-1 px-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {mark}
        <Tooltip label={`${centre} · tap to copy the code`} side="bottom">
          <button
            type="button"
            onClick={onCopyCode}
            aria-label={`Room code ${code}. Copy`}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md bg-bg-2 px-2 font-mono text-[13px] font-medium tracking-[0.12em] text-fg transition-colors",
              codeFlash && "bg-accent-soft text-accent",
            )}
          >
            {code}
            {copied ? (
              <Check size={13} aria-hidden="true" className="text-ok" />
            ) : (
              <Copy size={13} aria-hidden="true" className="text-fg-muted" />
            )}
          </button>
        </Tooltip>
        <span className="flex-1" />
        {mode === "demo" && !demoChipDismissed && !activity ? (
          <span className="inline-flex h-8 items-center overflow-hidden rounded-sm border border-accent/40 bg-accent-soft">
            <Link
              href="/create?map=zestafona&zone=default"
              className="px-2 font-mono text-[11px] font-medium tracking-[0.1em] whitespace-nowrap text-accent uppercase"
            >
              Open yours →
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => uiSet({ demoChipDismissed: true })}
              className="flex h-8 w-7 items-center justify-center text-accent hover:bg-accent/20"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ) : null}
        <SyncPill compact />
        <CallsignMenu compact />
      </header>
    );
  }

  return (
    <header
      className="@container hud-corners flex h-12 shrink-0 items-center gap-2 border-b border-line bg-bg-1 px-3"
      data-topbar=""
    >
      {mark}
      <span className="hidden font-mono text-[11px] tracking-[0.18em] text-fg-muted uppercase @[1000px]:inline">
        War room
      </span>
      <Tooltip label={`${centre} · click to copy the code`} side="bottom">
        <button
          type="button"
          onClick={onCopyCode}
          aria-label={`Room code ${code}. Copy`}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-md bg-bg-2 px-2.5 font-mono text-[14px] font-medium tracking-[0.12em] text-fg transition-colors hover:bg-bg-3",
            codeFlash && "bg-accent-soft text-accent",
          )}
        >
          {code}
          {copied ? (
            <Check size={14} aria-hidden="true" className="text-ok" />
          ) : (
            <Copy size={14} aria-hidden="true" className="text-fg-muted" />
          )}
        </button>
      </Tooltip>
      {mode === "demo" ? <Badge tone="accent">Live demo</Badge> : null}
      {mode !== "activity" ? (
        <Button
          variant="chip"
          onClick={copyLink}
          aria-label={copied ? "Link copied" : "Copy link"}
          className="gap-1.5"
        >
          {copied ? (
            <Check size={13} aria-hidden="true" className="text-ok" />
          ) : (
            <Copy size={13} aria-hidden="true" />
          )}
          <span>{copied ? "Copied" : "Copy link"}</span>
          <kbd className="hidden font-mono text-[10px] text-fg-faint @[1100px]:inline">Mod+C</kbd>
        </Button>
      ) : null}
      {command && mode !== "demo" ? (
        <Button variant="chip" onClick={() => openManage()} className="gap-1.5">
          <Settings2 size={13} aria-hidden="true" />
          Manage
        </Button>
      ) : null}
      <span
        className="mx-auto hidden truncate font-mono text-[11px] tracking-[0.16em] text-fg-muted uppercase @[900px]:inline"
        title={centre}
      >
        {mode === "demo" ? <DemoClock /> : centre}
      </span>
      <span className="mx-auto @[900px]:hidden" />
      <SyncPill />
      <Tooltip label={brief ? "Exit brief mode — B" : "Brief mode — B"} side="bottom">
        <Button
          variant="icon"
          size="icon"
          active={brief}
          aria-label="Brief mode"
          aria-keyshortcuts="b"
          onClick={() => setBrief(!brief)}
        >
          <Eye size={18} aria-hidden="true" />
        </Button>
      </Tooltip>
      <span className="hidden @[820px]:inline-flex">
        <CallsignMenu compact={false} />
      </span>
      <span className="inline-flex @[820px]:hidden">
        <CallsignMenu compact />
      </span>
      {role === "commander" ? (
        <Badge tone="accent" aria-label="Commander">
          CMD
        </Badge>
      ) : role === "co-commander" ? (
        <Badge tone="muted" className="border-accent/50 text-accent" aria-label="Co-commander">
          Co-CMD
        </Badge>
      ) : null}
    </header>
  );
}
