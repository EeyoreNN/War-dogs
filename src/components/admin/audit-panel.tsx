"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { AuditEntry, SimState } from "@/lib/admin-sim/types";
import { cn } from "@/lib/utils";
import { timeOfDay } from "./format";
import { MethodBadge } from "./method-badge";
import { SectionHeading } from "./select";
import { useSim } from "./sim-provider";

const PAGE = 60;

function AuditRow({ a, onSheet }: { a: AuditEntry; onSheet: (a: AuditEntry) => void }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const actor = a.actor === "server" ? "server" : `visitor ${a.actor}`;
  return (
    <li
      className={cn("border-t border-line", a.mine && "bg-[rgba(255,160,40,0.03)]")}
      data-testid="audit-row"
      data-mine={a.mine || undefined}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 text-sm">
        <span className="font-mono text-[12px] text-fg-faint tabular-nums">{timeOfDay(a.at)}</span>
        <span aria-hidden="true" className="text-fg-faint">
          ·
        </span>
        <span className={cn("font-medium", a.actor === "server" ? "text-fg-muted" : "text-fg")}>
          {actor}
        </span>
        {a.mine ? <Badge tone="accent">you</Badge> : null}
        <span aria-hidden="true" className="text-fg-faint">
          ·
        </span>
        <span className="font-mono text-[12px] tracking-[0.12em] text-accent uppercase">
          {a.action}
        </span>
        {a.target ? (
          <>
            <span aria-hidden="true" className="text-fg-faint">
              ·
            </span>
            <span className="text-fg">{a.target}</span>
          </>
        ) : null}
        <span aria-hidden="true" className="text-fg-faint">
          ·
        </span>
        <span
          className={cn(
            "font-mono text-[12px]",
            a.result === "ok" ? "text-ok" : "text-danger-text",
          )}
        >
          {a.result}
        </span>
        {a.detail ? (
          <>
            <span aria-hidden="true" className="text-fg-faint">
              ·
            </span>
            <span className="min-w-0 text-fg-muted">{a.detail}</span>
          </>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {a.rcon ? (
            <>
              <button
                type="button"
                className="font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase hover:text-fg"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "Hide call" : "RCON call"}
              </button>
              <Button variant="chip" onClick={() => onSheet(a)}>
                What this sends
              </Button>
            </>
          ) : (
            <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
              {a.actor === "server" ? "match result" : "local only"}
            </span>
          )}
        </span>
      </div>
      {open && a.rcon ? (
        <div id={id} className="mb-3 rounded-md border border-line bg-bg-0 p-3">
          <p className="flex flex-wrap items-center gap-2">
            <MethodBadge method={a.rcon.method} />
            <code className="font-mono text-[12px] break-all text-fg">{a.rcon.path}</code>
          </p>
          {a.rcon.body !== null ? (
            <pre className="mt-2 scrollbar-thin overflow-x-auto font-mono text-[12px] leading-relaxed text-fg-muted">
              {JSON.stringify(a.rcon.body, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function AuditPanel({ state }: { state: SimState }) {
  const { openSheet } = useSim();
  const [filter, setFilter] = React.useState<"all" | "mine">("all");
  const [limit, setLimit] = React.useState(PAGE);
  const rows = filter === "mine" ? state.audit.filter((a) => a.mine) : state.audit;
  const shown = rows.slice(0, limit);
  const mine = state.audit.filter((a) => a.mine).length;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Audit trail"
        actions={
          <div className="flex gap-2" role="group" aria-label="Filter">
            <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
              All · {state.audit.length}
            </Chip>
            <Chip selected={filter === "mine"} onClick={() => setFilter("mine")}>
              Mine · {mine}
            </Chip>
          </div>
        }
      >
        Every command since 04:00Z, newest first, with the exact RCON call behind it. Server rows
        are match results.
      </SectionHeading>
      <div className="panel px-4 sm:px-6">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">
            {filter === "mine"
              ? "Nothing yet. Take an action on the Live tab and it lands here under your callsign."
              : "Nothing since 04:00Z."}
          </p>
        ) : (
          <ol className="flex flex-col" aria-label="Audit entries">
            {shown.map((a) => (
              <AuditRow key={a.id} a={a} onSheet={openSheet} />
            ))}
          </ol>
        )}
        {rows.length > shown.length ? (
          <div className="border-t border-line py-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, rows.length - shown.length)} more
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
