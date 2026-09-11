"use client";

// Requests panel (§4.3.4): header with count and + New, filter tabs, ranked cards with pins,
// age timers, urgency, ETA, claim / deliver / release, edit and delete.
import * as React from "react";
import { Box, ChevronsRight, Cross, Fuel, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { gridRef } from "@/lib/map/grid";
import {
  ageState,
  canEdit,
  etaRemaining,
  filterRequests,
  rankRequests,
  suggestedFocus,
  type RequestFilter,
} from "@/lib/map/requests";
import { focusTally, isCommand } from "@/lib/map/roster";
import {
  FOCUS_LABEL,
  REQUEST_KIND_LABEL,
  REQUEST_KINDS,
  type RequestKind,
  type RequestPriority,
  type SupplyRequest,
} from "@/lib/map/types";
import { cn } from "@/lib/utils";
import { now, selectMe, useRoomStore } from "@/store/room";
import {
  claimRequest,
  deliverRequest,
  editRequest,
  releaseRequest,
  removeRequest,
  setRequestEta,
} from "./actions";
import { useNow } from "./context";
import { formatAbsoluteTime, formatAgeClock, formatEta } from "./lib/format";
import { useUiStore } from "./ui-store";

export const KIND_ICON: Record<
  RequestKind,
  React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true"; className?: string }>
> = {
  fuel: Fuel,
  medical: Cross,
  ammo: Package,
  other: Box,
};

export const DELIVERED_LINGER_MS = 8_000;

const ETA_CHIPS: { label: string; sec: number }[] = [
  { label: "30s", sec: 30 },
  { label: "1m", sec: 60 },
  { label: "2m", sec: 120 },
  { label: "5m", sec: 300 },
];

export function RequestsPanel({ inSheet = false }: { inSheet?: boolean }) {
  const requests = useRoomStore((s) => s.state?.requests);
  const roster = useRoomStore((s) => s.state?.roster);
  const presence = useRoomStore((s) => s.presence);
  const me = useRoomStore(selectMe);
  const meId = useRoomStore((s) => s.me?.client ?? null);
  const highlightId = useRoomStore((s) => s.highlightId);
  const highlight = useRoomStore((s) => s.highlight);
  const filter = useUiStore((s) => s.requestFilter);
  const uiSet = useUiStore((s) => s.set);
  const api = useUiStore((s) => s.viewportApi);
  const t = useNow(1000, now);
  const [confirmRelease, setConfirmRelease] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<SupplyRequest | null>(null);

  const list = React.useMemo(() => Object.values(requests ?? {}), [requests]);
  const counted = list.filter((r) => r.status !== "delivered").length;
  const filtered = React.useMemo(() => {
    const f = filterRequests(list, filter, meId);
    if (filter === "mine" || filter === "done")
      return f.slice().sort((a, b) => b.createdAt - a.createdAt);
    const ranked = rankRequests(f, me, t);
    if (filter === "open") return ranked;
    // Just-delivered cards linger in ALL for a few seconds so the hand-off is seen (motion "claim").
    const lingering = list
      .filter(
        (r) =>
          r.status === "delivered" &&
          r.deliveredAt !== null &&
          t - r.deliveredAt < DELIVERED_LINGER_MS,
      )
      .sort((a, b) => (b.deliveredAt ?? 0) - (a.deliveredAt ?? 0));
    return [...ranked, ...lingering];
  }, [list, filter, meId, me, t]);
  const tally = React.useMemo(
    () => focusTally(Object.values(roster ?? {}), presence, t),
    [roster, presence, t],
  );
  const pinIndex = React.useMemo(() => {
    const pinned = list.filter((r) => r.at).sort((a, b) => a.createdAt - b.createdAt);
    return new Map(pinned.map((r, i) => [r.id, i + 1]));
  }, [list]);

  const empty =
    filter === "mine"
      ? "Nothing claimed by you."
      : filter === "done"
        ? "Nothing delivered yet."
        : "No requests yet. Press N or + to ask for fuel, medical or ammo.";

  return (
    <section
      aria-labelledby="requests-heading"
      className="flex min-h-0 flex-1 flex-col"
      data-panel="requests"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        <Package size={16} aria-hidden="true" className="text-fg-muted" />
        <h2 id="requests-heading" className="label-mono text-fg">
          Requests
        </h2>
        <Badge tone={counted ? "accent" : "muted"} aria-label={`${counted} open or claimed`}>
          {counted}
        </Badge>
        <span className="flex-1" />
        <Button
          variant="chip"
          onClick={() => uiSet({ newRequestOpen: true })}
          className="gap-1 px-2"
          aria-keyshortcuts="n"
        >
          <Plus size={13} aria-hidden="true" />
          New
          <kbd className="ml-0.5 font-mono text-[10px] text-fg-faint">N</kbd>
        </Button>
        {!inSheet ? (
          <Button
            variant="icon"
            size="icon"
            aria-label="Hide panels"
            onClick={() => uiSet({ panelsOpen: false })}
            className="h-8 w-8"
          >
            <ChevronsRight size={16} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <Tabs
        size="sm"
        aria-label="Request filter"
        value={filter}
        onChange={(v) => uiSet({ requestFilter: v as RequestFilter })}
        className="shrink-0 px-2"
        items={[
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "mine", label: "Mine" },
          { value: "done", label: "Done" },
        ]}
      />
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">{empty}</p>
        ) : (
          <ul role="list" aria-label="Requests" className="flex flex-col gap-1.5 p-2">
            {filtered.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                now={t}
                me={me}
                meId={meId}
                pin={pinIndex.get(r.id) ?? null}
                highlighted={highlightId === r.id}
                onHover={(on) => highlight(on ? r.id : null)}
                onCentre={() => r.at && api?.centreOn(r.at)}
                onRelease={() => {
                  if (r.claimedAt !== null && t - r.claimedAt > 60_000) setConfirmRelease(r.id);
                  else releaseRequest(r.id);
                }}
                onEdit={() => setEditing(r)}
                missingFocus={
                  r.status === "open" &&
                  suggestedFocus(r.kind).length > 0 &&
                  suggestedFocus(r.kind).every((f) => tally[f] === 0)
                    ? `No ${FOCUS_LABEL[suggestedFocus(r.kind)[0]].toLowerCase()} in room`
                    : null
                }
              />
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={confirmRelease !== null}
        onClose={() => setConfirmRelease(null)}
        onConfirm={() => {
          if (confirmRelease) releaseRequest(confirmRelease);
          setConfirmRelease(null);
        }}
        title="Release this request?"
        body="It has been claimed for more than a minute. Releasing puts it back in the open list for someone else."
        confirmLabel="Release"
      />
      {editing ? <EditRequestDialog request={editing} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function RequestCard({
  request: r,
  now: t,
  me,
  meId,
  pin,
  highlighted,
  onHover,
  onCentre,
  onRelease,
  onEdit,
  missingFocus,
}: {
  request: SupplyRequest;
  now: number;
  me: ReturnType<typeof selectMe>;
  meId: string | null;
  pin: number | null;
  highlighted: boolean;
  onHover: (on: boolean) => void;
  onCentre: () => void;
  onRelease: () => void;
  onEdit: () => void;
  missingFocus: string | null;
}) {
  const Icon = KIND_ICON[r.kind];
  const age = ageState(r, t);
  const eta = etaRemaining(r, t);
  const mine = r.by === meId;
  const claimer = r.claimedBy === meId;
  const editable = me ? canEdit(r, me) : false;
  const command = isCommand(me);
  const stateColor =
    r.status === "open"
      ? "text-fg"
      : r.status === "claimed"
        ? "text-accent"
        : "text-req-delivered-text";
  const rule =
    r.status === "open"
      ? "border-l-req-open"
      : r.status === "claimed"
        ? "border-l-req-claimed"
        : "border-l-req-delivered";
  const timerColor =
    age === "stale" ? "text-danger-text" : age === "aging" ? "text-accent" : "text-fg-muted";
  return (
    <li
      role="listitem"
      data-request-id={r.id}
      data-request-status={r.status}
      tabIndex={-1}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onHover(false);
      }}
      className={cn(
        "flex min-h-16 flex-col gap-1.5 rounded-md border border-l-[3px] border-line bg-bg-1 px-3 py-2 transition-colors duration-200",
        rule,
        highlighted && "border-line-hi bg-bg-2",
        r.status === "delivered" && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon size={15} aria-hidden="true" className={stateColor} />
        <span className="text-[15px] font-semibold text-fg">{REQUEST_KIND_LABEL[r.kind]}</span>
        <span className={cn("font-mono text-[11px] tracking-[0.14em] uppercase", stateColor)}>
          {r.status}
        </span>
        {r.priority === "urgent" && r.status !== "delivered" ? (
          <Badge tone="danger" className="animate-pulse-slow px-1.5">
            Urgent
          </Badge>
        ) : null}
        {r.at ? (
          <Tooltip label={`Centre the map on ${gridRef(r.at, true)}`} side="top">
            <button
              type="button"
              onClick={onCentre}
              className="rounded-sm bg-bg-2 px-1.5 font-mono text-[11px] leading-5 text-fg hover:bg-bg-3"
            >
              {pin ? <span className="text-fg-faint">#{pin} </span> : null}
              {gridRef(r.at)}
            </button>
          </Tooltip>
        ) : null}
        <span className="flex-1" />
        <Tooltip label={`Requested at ${formatAbsoluteTime(r.createdAt)}`} side="left">
          <span
            tabIndex={0}
            aria-live="off"
            className={cn(
              "cursor-default rounded-sm font-mono text-[12px] tabular-nums",
              timerColor,
            )}
          >
            {formatAgeClock(t - r.createdAt)}
          </span>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-fg-muted">
        <span>by {r.byName}</span>
        {r.status === "claimed" && r.claimedByName ? (
          <span>· claimed by {r.claimedByName}</span>
        ) : null}
        {r.status === "claimed" && eta !== null ? (
          <span
            className={cn(
              "font-mono text-[12px] tabular-nums",
              eta < 0 ? "text-danger-text" : "text-accent",
            )}
            aria-live="off"
          >
            · {formatEta(eta)}
          </span>
        ) : null}
        {r.note ? (
          <Tooltip label={r.note} side="top">
            <span tabIndex={0} className="max-w-full truncate rounded-sm text-fg">
              · {r.note}
            </span>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {r.status === "open" ? (
          <Button size="sm" onClick={() => claimRequest(r.id)}>
            Claim
          </Button>
        ) : null}
        {r.status === "claimed" && (claimer || command) ? (
          <>
            <Button size="sm" onClick={() => deliverRequest(r.id)}>
              Delivered
            </Button>
            <Button size="sm" variant="ghost" onClick={onRelease}>
              Release
            </Button>
          </>
        ) : null}
        {r.status === "claimed" && claimer ? (
          <span role="group" aria-label="Set ETA" className="ml-auto flex gap-1">
            {ETA_CHIPS.map((c) => (
              <button
                key={c.sec}
                type="button"
                aria-pressed={r.etaSec === c.sec}
                onClick={() => setRequestEta(r.id, c.sec)}
                className={cn(
                  "h-7 rounded-sm border border-line-strong px-1.5 font-mono text-[11px] text-fg-muted hover:text-fg",
                  r.etaSec === c.sec && "border-accent bg-accent-soft text-accent",
                )}
              >
                {c.label}
              </button>
            ))}
          </span>
        ) : null}
        {r.status === "delivered" && editable ? (
          <Button size="sm" variant="ghost" onClick={() => removeRequest(r.id)}>
            Delete
          </Button>
        ) : null}
        {editable && r.status !== "delivered" ? (
          <span className="ml-auto flex">
            <Button
              variant="icon"
              size="icon"
              className="h-8 w-8"
              aria-label="Edit request"
              onClick={onEdit}
            >
              <Pencil size={14} aria-hidden="true" />
            </Button>
            <Button
              variant="icon"
              size="icon"
              className="h-8 w-8"
              aria-label="Delete request"
              onClick={() => removeRequest(r.id)}
            >
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </span>
        ) : null}
      </div>
      {missingFocus ? (
        <p className="font-mono text-[11px] tracking-[0.08em] text-warn uppercase">
          {missingFocus}
        </p>
      ) : null}
      {mine && r.status === "open" ? <span className="sr-only">Your request</span> : null}
    </li>
  );
}

function EditRequestDialog({ request, onClose }: { request: SupplyRequest; onClose: () => void }) {
  const [kind, setKind] = React.useState<RequestKind>(request.kind);
  const [priority, setPriority] = React.useState<RequestPriority>(request.priority);
  const [note, setNote] = React.useState(request.note);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit request"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              editRequest(request.id, { kind, priority, note: note.trim().slice(0, 60) });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <KindPriorityFields
        kind={kind}
        setKind={setKind}
        priority={priority}
        setPriority={setPriority}
        note={note}
        setNote={setNote}
        idPrefix="edit"
      />
    </Dialog>
  );
}

export function KindPriorityFields({
  kind,
  setKind,
  priority,
  setPriority,
  note,
  setNote,
  idPrefix,
}: {
  kind: RequestKind;
  setKind: (k: RequestKind) => void;
  priority: RequestPriority;
  setPriority: (p: RequestPriority) => void;
  note: string;
  setNote: (n: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Kind" className="grid grid-cols-4 gap-2">
        {REQUEST_KINDS.map((k, i) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-md border border-line-strong bg-bg-1 text-[12px] font-semibold text-fg-muted hover:border-line-hi hover:text-fg",
                kind === k && "border-accent bg-accent-soft text-accent",
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {REQUEST_KIND_LABEL[k]}
              <span className="sr-only">, key {i + 1}</span>
            </button>
          );
        })}
      </div>
      <div role="radiogroup" aria-label="Priority" className="grid grid-cols-2 gap-2">
        {(["normal", "urgent"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={priority === p}
            onClick={() => setPriority(p)}
            className={cn(
              "h-10 rounded-md border border-line-strong bg-bg-1 font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase hover:text-fg",
              priority === p &&
                (p === "urgent"
                  ? "border-danger/60 bg-danger/10 text-danger-text"
                  : "border-accent bg-accent-soft text-accent"),
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <Field label="Note" htmlFor={`${idPrefix}-note`} helper="Optional, up to 60 characters.">
        <Input
          value={note}
          maxLength={60}
          placeholder="e.g. two jerry cans at the LZ"
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
    </div>
  );
}
