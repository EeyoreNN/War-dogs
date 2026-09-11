"use client";

// Roster panel (§4.3.5): tallies, focus warnings, draw requests, commander / team sections,
// rows with ink dot, role icon, focus chip, idle dot, offline state and the command menu.
import * as React from "react";
import { CircleHelp, Copy, Crown, MoreHorizontal, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { focusTally, focusWarnings, isCommand, isIdle, isOnline } from "@/lib/map/roster";
import { FOCUS_LABEL, FOCUSES, INK_HEX, type Presence, type RosterMember } from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { now, selectMe, useRoomStore } from "@/store/room";
import {
  approveDraw,
  denyDraw,
  handOffCommand,
  kickMember,
  revokeDraw,
  setCoCommander,
} from "./actions";
import { useNow } from "./context";
import { FocusHelpDialog } from "./forms/FocusHelp";
import { FocusGrid } from "./forms/FocusPicker";
import { useCopyLink } from "./TopBar";

export function RosterPanel({ inSheet = false }: { inSheet?: boolean }) {
  const roster = useRoomStore((s) => s.state?.roster);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const presence = useRoomStore((s) => s.presence);
  const activity = useRoomStore((s) => s.activity);
  const me = useRoomStore(selectMe);
  const code = useRoomStore((s) => s.code) ?? "";
  const t = useNow(5000, now);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const { copyLink } = useCopyLink(code);

  const members = React.useMemo(() => Object.values(roster ?? {}), [roster]);
  const tally = React.useMemo(() => focusTally(members, presence, t), [members, presence, t]);
  const warnings = focusWarnings(tally);
  const online = members.filter((m) => isOnline(m, presence[m.id], t)).length;
  const drawRequests = members.filter((m) => m.drawRequested).length;
  const command = isCommand(me);
  const byJoined = (a: RosterMember, b: RosterMember) => a.joinedAt - b.joinedAt;
  const commanders = members.filter((m) => isCommand(m)).sort(byJoined);
  const team = members.filter((m) => !isCommand(m)).sort(byJoined);

  const row = (m: RosterMember) => (
    <RosterRow
      key={m.id}
      m={m}
      me={me}
      command={command}
      presence={presence[m.id]}
      lastActive={activity[m.id]}
      now={t}
      requestMode={settings?.drawAccess === "request"}
    />
  );

  const sections: { title: string; items: RosterMember[] }[] = [
    { title: "Commander", items: commanders },
  ];
  if (settings?.squadMode) {
    for (const q of settings.squads)
      sections.push({ title: q, items: team.filter((m) => m.squad === q) });
    const unassigned = team.filter((m) => !m.squad || !settings.squads.includes(m.squad));
    if (unassigned.length) sections.push({ title: "Team", items: unassigned });
  } else sections.push({ title: "Team", items: team });

  return (
    <section
      aria-labelledby="roster-heading"
      className={cn("flex min-h-0 flex-col", inSheet ? "flex-1" : "flex-1 border-t border-line")}
      data-panel="roster"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Users size={16} aria-hidden="true" className="text-fg-muted" />
        <h2 id="roster-heading" className="label-mono text-fg">
          Roster
        </h2>
        <Badge tone="muted" aria-label={`${online} online`}>
          {online}
        </Badge>
        {drawRequests ? <Badge tone="accent">{drawRequests} asking to draw</Badge> : null}
        <span className="flex-1" />
        <Button
          variant="icon"
          size="icon"
          className="h-8 w-8"
          aria-label="How focus and map access work"
          onClick={() => setHelpOpen(true)}
        >
          <CircleHelp size={16} aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-2" aria-label="Focus tally">
        {FOCUSES.map((f) => (
          <span
            key={f}
            className={cn(
              "rounded-sm border border-line px-1.5 font-mono text-[10px] leading-5 tracking-[0.06em] uppercase",
              tally[f] === 0 ? "text-fg-faint" : "text-fg",
            )}
          >
            {FOCUS_LABEL[f]} {tally[f]}
          </span>
        ))}
      </div>
      {warnings.length ? (
        <p className="px-3 pb-2 font-mono text-[11px] tracking-[0.08em] text-warn uppercase">
          {warnings.join(" · ")}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
        {members.length <= 1 ? (
          <div className="px-3 py-4 text-sm text-fg-muted">
            <p>Only you so far. Copy the link and send it to your team.</p>
            <Button variant="secondary" size="sm" className="mt-3 gap-1.5" onClick={copyLink}>
              <Copy size={13} aria-hidden="true" />
              Copy link
            </Button>
          </div>
        ) : null}
        <ul role="list" aria-label="Roster" className="pb-2">
          {sections.map((s) => (
            <li key={s.title} className="contents">
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 label-mono">
                {s.title === "Commander" ? (
                  <Crown size={11} aria-hidden="true" className="text-accent" />
                ) : null}
                {s.title} <span className="text-fg-faint">{s.items.length}</span>
              </div>
              <ul role="list" aria-label={s.title}>
                {s.items.map(row)}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <FocusHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </section>
  );
}

function RosterRow({
  m,
  me,
  command,
  presence,
  lastActive,
  now: t,
  requestMode,
}: {
  m: RosterMember;
  me: RosterMember | null;
  command: boolean;
  presence: Presence | undefined;
  lastActive: number | undefined;
  now: number;
  requestMode: boolean;
}) {
  const online = isOnline(m, presence, t);
  const idle = online && isIdle(lastActive, t);
  const self = me?.id === m.id;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"kick" | "handoff" | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const updateIdentity = useRoomStore((s) => s.updateIdentity);
  const [focusOpen, setFocusOpen] = React.useState(false);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      )
        setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [menuOpen]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[
        e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length
      ]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenuOpen(false);
      btnRef.current?.focus();
    }
  };

  const item = (label: string, onSelect: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenuOpen(false);
        onSelect();
      }}
      className={cn(
        "block w-full px-3 py-2 text-left text-sm text-fg hover:bg-bg-2 focus-visible:bg-bg-2",
        danger && "text-danger-text",
      )}
    >
      {label}
    </button>
  );

  return (
    <li
      role="listitem"
      data-member-id={m.id}
      className={cn("flex min-h-10 items-center gap-2 px-3 py-1", !online && "opacity-50")}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: INK_HEX[m.ink] }}
      />
      <span className="min-w-0 flex-1 truncate text-[15px] text-fg">
        {m.callsign}
        {self ? <span className="text-fg-muted"> (you)</span> : null}
      </span>
      {m.role === "commander" ? (
        <Crown size={13} aria-label="Commander" className="shrink-0 text-accent" />
      ) : m.role === "co-commander" ? (
        <Star size={13} aria-label="Co-commander" className="shrink-0 text-accent" />
      ) : null}
      {m.focus ? (
        self ? (
          <button
            type="button"
            onClick={() => setFocusOpen(true)}
            className="rounded-sm border border-line px-1.5 font-mono text-[10px] leading-5 tracking-[0.06em] text-fg-muted uppercase hover:text-fg"
            aria-label={`Focus ${FOCUS_LABEL[m.focus]}. Change`}
          >
            {FOCUS_LABEL[m.focus]}
          </button>
        ) : (
          <span className="rounded-sm border border-line px-1.5 font-mono text-[10px] leading-5 tracking-[0.06em] text-fg-muted uppercase">
            {FOCUS_LABEL[m.focus]}
          </span>
        )
      ) : self ? (
        <button
          type="button"
          onClick={() => setFocusOpen(true)}
          className="rounded-sm border border-dashed border-line px-1.5 font-mono text-[10px] leading-5 tracking-[0.06em] text-fg-faint uppercase hover:text-fg"
        >
          Focus
        </button>
      ) : null}
      {!online ? (
        <span className="font-mono text-[10px] tracking-[0.08em] text-fg-muted uppercase">
          offline
        </span>
      ) : idle ? (
        <span
          title="Idle"
          aria-label="Idle"
          role="img"
          className="h-1.5 w-1.5 rounded-full bg-fg-faint"
        />
      ) : null}
      {m.drawRequested && command && !self ? (
        <span className="flex gap-1">
          <Button variant="chip" className="h-7 px-2" onClick={() => approveDraw(m.id)}>
            Approve
          </Button>
          <Button variant="chip" className="h-7 px-2" onClick={() => denyDraw(m.id)}>
            Deny
          </Button>
        </span>
      ) : null}
      {command && !self ? (
        <span className="relative">
          <button
            ref={btnRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`More actions for ${m.callsign}`}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-2 hover:text-fg"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${m.callsign}`}
              onKeyDown={onMenuKey}
              className="absolute top-full right-0 z-50 mt-1 w-52 overflow-hidden rounded-md border border-line-strong bg-bg-1 py-1 shadow-panel"
            >
              {m.role === "co-commander"
                ? item("Remove co-commander", () => setCoCommander(m.id, false))
                : m.role === "member"
                  ? item("Make co-commander", () => setCoCommander(m.id, true))
                  : null}
              {requestMode
                ? m.canDraw
                  ? item("Revoke drawing", () => revokeDraw(m.id))
                  : item("Allow drawing", () => approveDraw(m.id))
                : null}
              {me?.role === "commander"
                ? item("Hand off command", () => setConfirm("handoff"))
                : null}
              {item("Kick", () => setConfirm("kick"), true)}
            </div>
          ) : null}
        </span>
      ) : null}
      <ConfirmDialog
        open={confirm === "kick"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          kickMember(m.id);
          setConfirm(null);
        }}
        title={`Kick ${m.callsign}?`}
        body="They are removed from the roster and, on a relay, disconnected. There is no identity behind a callsign, so they can come back from another browser."
        confirmLabel="Kick"
        tone="danger"
      />
      <ConfirmDialog
        open={confirm === "handoff"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          handOffCommand(m.id);
          setConfirm(null);
        }}
        title={`Hand command to ${m.callsign}?`}
        body="They become commander and you become a member. You can be made co-commander afterwards."
        confirmLabel="Hand off"
      />
      {focusOpen ? (
        <FocusDialog
          value={m.focus}
          onClose={() => setFocusOpen(false)}
          onChange={(f) => {
            updateIdentity({ focus: f });
            setFocusOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}

function FocusDialog({
  value,
  onClose,
  onChange,
}: {
  value: RosterMember["focus"];
  onClose: () => void;
  onChange: (f: RosterMember["focus"]) => void;
}) {
  return (
    <Dialog open onClose={onClose} title="Change focus" size="sm">
      <FocusGrid value={value} onChange={onChange} />
      <div className="mt-3">
        <Tooltip label="Clears your focus" side="top">
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            No focus
          </Button>
        </Tooltip>
      </div>
    </Dialog>
  );
}
