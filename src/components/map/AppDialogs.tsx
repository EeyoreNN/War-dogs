"use client";

// The app's dialogs (§4.3.1, §4.3.5, §4.3.7, §4.3.9): join, squad pick, nothing here yet,
// removed, promoted, room full, copy fallback, downloads blocked.
import * as React from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { site } from "@/config/site";
import type { RoomSettings } from "@/lib/map/types";
import { CallsignSchema } from "@/lib/map/schema";
import type { Focus, Identity } from "@/lib/map/types";
import { generateCallsign } from "@/lib/storage/identity";
import { useRoomStore, selectMe } from "@/store/room";
import { updateMember } from "./actions";
import { useMapApp } from "./context";
import { FocusGrid } from "./forms/FocusPicker";
import { useUiStore } from "./ui-store";

/** Join war room {CODE}: callsign, focus grid, squad (when known). Cannot be dismissed. */
export function JoinDialog({
  open,
  code,
  identity,
  squads,
  activityCopy,
  onJoin,
}: {
  open: boolean;
  code: string;
  identity: Identity;
  squads: string[] | null;
  activityCopy?: boolean;
  onJoin: (identity: Identity, squad: string | null) => void;
}) {
  const [callsign, setCallsign] = React.useState(identity.callsign);
  const [placeholder] = React.useState(() => generateCallsign());
  const [focus, setFocus] = React.useState<Focus | null>(identity.focus);
  const [squad, setSquad] = React.useState<string | null>(squads?.[0] ?? null);
  const [error, setError] = React.useState<string | undefined>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = () => {
    const r = CallsignSchema.safeParse(callsign || placeholder);
    if (!r.success) {
      setError("2 to 24 characters.");
      return;
    }
    onJoin({ ...identity, callsign: r.data, focus }, squad);
  };

  return (
    <Dialog
      open={open}
      onClose={() => undefined}
      title={`Join war room ${code}`}
      description={activityCopy ? "Sign-in needs a server; use a callsign for now." : undefined}
      size="sm"
      initialFocusRef={inputRef}
      footer={
        <Button onClick={submit} className="w-full sm:w-auto">
          Join
        </Button>
      }
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && submit()}
      >
        <Field
          label="Your callsign"
          htmlFor="join-callsign"
          error={error}
          trailing={
            <Button
              variant="chip"
              onClick={() => setCallsign(generateCallsign())}
              aria-label="Generate a callsign"
              className="gap-1"
            >
              <Dices size={13} aria-hidden="true" /> Dice
            </Button>
          }
        >
          <Input
            ref={inputRef}
            value={callsign}
            placeholder={placeholder}
            maxLength={24}
            autoComplete="off"
            onChange={(e) => setCallsign(e.target.value)}
          />
        </Field>
        <div>
          <p className="mb-2 label-mono">
            Your focus <span className="text-fg-faint">optional</span>
          </p>
          <FocusGrid value={focus} onChange={setFocus} compact />
        </div>
        {squads && squads.length ? (
          <Field label="Your squad" htmlFor="join-squad">
            <select
              id="join-squad"
              value={squad ?? ""}
              onChange={(e) => setSquad(e.target.value || null)}
              className="h-12 w-full rounded-md border border-line-strong bg-bg-1 px-3 text-[15px] text-fg"
            >
              {squads.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

/** The squad pick after sync reveals squadMode (§4.3.1 step 5). */
export function SquadPickDialog() {
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  const me = useRoomStore(selectMe);
  const meId = useRoomStore((s) => s.me?.client ?? null);
  const [dismissed, setDismissed] = React.useState(false);
  const open =
    !!settings?.squadMode && !!me && !me.squad && !dismissed && settings.squads.length > 0;
  if (!settings || !meId) return null;
  return (
    <Dialog
      open={open}
      onClose={() => setDismissed(true)}
      title="Which squad are you in?"
      size="sm"
      description="This room runs squads: each plans on its own layer."
    >
      <div className="grid gap-2">
        {settings.squads.map((q) => (
          <Button
            key={q}
            variant="secondary"
            onClick={() => updateMember(meId, { squad: q })}
            className="justify-start"
          >
            {q}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}

const TEAMS: readonly string[] = site.game.teams;
function freshSettings(
  hint: { team?: string; squad?: string } | null,
): Partial<RoomSettings> | undefined {
  const team =
    hint?.team && TEAMS.includes(hint.team) ? (hint.team as RoomSettings["team"]) : undefined;
  return team ? { team } : undefined;
}

export function StateDialogs() {
  const code = useRoomStore((s) => s.code ?? "");
  const awaitingPlan = useRoomStore((s) => s.awaitingPlan);
  const kicked = useRoomStore((s) => s.kicked);
  const roomFull = useRoomStore((s) => s.roomFull);
  const pendingPromotion = useRoomStore((s) => s.pendingPromotion);
  const startFresh = useRoomStore((s) => s.startFresh);
  const acceptPromotion = useRoomStore((s) => s.acceptPromotion);
  const declinePromotion = useRoomStore((s) => s.declinePromotion);
  const leave = useRoomStore((s) => s.leave);
  const copyFallback = useUiStore((s) => s.copyFallback);
  const downloadBlocked = useUiStore((s) => s.downloadBlocked);
  const uiSet = useUiStore((s) => s.set);
  const { mode, go, rejoin, openExternal, joinHint } = useMapApp();
  const [waiting, setWaiting] = React.useState(false);
  const fallbackRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (copyFallback) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [copyFallback]);

  return (
    <>
      <Dialog
        open={awaitingPlan && !waiting}
        onClose={() => setWaiting(true)}
        title="Nothing here yet"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWaiting(true)}>
              Wait for the plan
            </Button>
            <Button onClick={() => startFresh(freshSettings(joinHint))}>
              Start a fresh plan here
            </Button>
          </>
        }
      >
        <p className="text-fg-muted">
          This browser has no plan for {code}. In LOCAL mode only tabs in this browser share a room;
          on a relay the plan arrives as soon as someone who has it is online.
        </p>
      </Dialog>
      <Dialog
        open={kicked}
        onClose={() => undefined}
        title="You were removed from this room"
        size="sm"
        footer={
          <Button
            onClick={() => {
              leave();
              if (mode === "activity") rejoin();
              else go("/join");
            }}
          >
            {mode === "activity" ? "Join again" : "Back to join"}
          </Button>
        }
      >
        <p className="text-fg-muted">
          The commander removed you. There is no identity behind a callsign, so you can join again
          from another browser profile.
        </p>
      </Dialog>
      <Dialog
        open={roomFull}
        onClose={() => undefined}
        title="This room is full (64)"
        size="sm"
        footer={<Button onClick={() => go("/")}>Back home</Button>}
      >
        <p className="text-fg-muted">
          The relay allows 64 connections per room. Ask the commander to open a second room.
        </p>
      </Dialog>
      <Dialog
        open={pendingPromotion}
        onClose={acceptPromotion}
        title="You are now commander"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={declinePromotion}>
              Decline
            </Button>
            <Button onClick={acceptPromotion}>OK</Button>
          </>
        }
      >
        <p className="text-fg-muted">
          The previous commander left. You can manage the room, or decline to hand it to the next
          person.
        </p>
      </Dialog>
      <Dialog
        open={copyFallback !== null}
        onClose={() => uiSet({ copyFallback: null })}
        title={copyFallback?.title ?? "Copy this link"}
        size="sm"
      >
        <p className="mb-3 text-fg-muted">
          The clipboard is not available here. Select the text and copy it.
        </p>
        <Input
          ref={fallbackRef}
          readOnly
          value={copyFallback?.text ?? ""}
          aria-label="Text to copy"
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-[13px]"
        />
      </Dialog>
      <Dialog
        open={downloadBlocked}
        onClose={() => uiSet({ downloadBlocked: false })}
        title="Downloads are blocked inside Discord"
        size="sm"
        footer={
          <Button
            onClick={() => {
              openExternal(`${site.url}/join?code=${code}`);
              uiSet({ downloadBlocked: false });
            }}
          >
            Open wardogs.tech in your browser
          </Button>
        }
      >
        <p className="text-fg-muted">
          Export PNG and Save plan need a real browser tab. Copy plan as text still works here.
        </p>
      </Dialog>
    </>
  );
}
