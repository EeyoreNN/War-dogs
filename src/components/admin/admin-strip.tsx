"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { toast } from "@/components/ui/toast";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import { useSim } from "./sim-provider";

/**
 * The 48 px admin header (§4.8): lockup left, `Proof of concept` right; on dashboard routes
 * also the `Not real` badge, the visitor callsign chip (click to change, saved back to
 * `wardogs:identity`) and `Reset to 04:00Z snapshot`.
 */
export function AdminStrip() {
  const pathname = usePathname();
  const dashboard = pathname !== "/demo/admin";
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg-0/85 backdrop-blur-[12px]">
      <div className="mx-auto flex h-12 w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label={`${site.name} home`} className="rounded-sm">
          <Logo size="sm" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          {dashboard ? <DashboardControls /> : null}
          <Badge tone="accent" className="hidden sm:inline-flex">
            Proof of concept
          </Badge>
        </div>
      </div>
    </header>
  );
}

function DashboardControls() {
  const { me, setCallsign, reset, state } = useSim();
  const [editing, setEditing] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const mine = state?.audit.filter((a) => a.mine).length ?? 0;

  return (
    <>
      <Badge tone="warn" className="hidden md:inline-flex">
        Not real
      </Badge>
      <button
        type="button"
        onClick={() => {
          setDraft(me);
          setEditing(true);
        }}
        className={cn(
          "inline-flex h-8 max-w-[46vw] items-center gap-1.5 rounded-sm border border-line-strong bg-bg-1 px-2.5 font-mono text-[11px] tracking-[0.12em] text-fg uppercase transition-colors hover:border-line-hi hover:bg-bg-2 sm:max-w-none",
        )}
        aria-label={me ? `Visitor ${me}. Change callsign` : "Change callsign"}
        data-testid="callsign-chip"
      >
        <UserRound size={13} aria-hidden="true" className="shrink-0 text-accent" />
        <span className="text-fg-faint">visitor</span>
        <span className="truncate normal-case">{me || "…"}</span>
      </button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirm(true)}
        className="px-2 sm:px-3"
        aria-label="Reset to 04:00Z snapshot"
      >
        <RotateCcw size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Reset to 04:00Z snapshot</span>
      </Button>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Your callsign"
        description="The name your actions land under in the audit trail. It is the same callsign you use in war rooms."
        size="sm"
        initialFocusRef={inputRef}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!draft.trim()) return;
                setCallsign(draft);
                setEditing(false);
                toast(`Callsign saved: ${draft.trim()}`);
              }}
              disabled={!draft.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setCallsign(draft);
            setEditing(false);
          }}
        >
          <Field label="Callsign" htmlFor="callsign">
            <Input
              ref={inputRef}
              value={draft}
              maxLength={24}
              autoComplete="off"
              placeholder="e.g. Reaper"
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          reset();
          setConfirm(false);
          toast("Reset to the 04:00Z snapshot. Kicks, bans and rotation edits are gone.", {
            tone: "ok",
          });
        }}
        title="Reset to 04:00Z snapshot"
        confirmLabel="Reset"
        tone="danger"
        body={
          <>
            Every command written in this browser since 04:00Z is discarded
            {mine ? ` (${mine} of them yours)` : ""}. The server keeps playing; only what visitors
            changed goes away. Other tabs in this browser follow.
          </>
        }
      />
    </>
  );
}
