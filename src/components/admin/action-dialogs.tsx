"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { site, type Team } from "@/config/site";
import { MAP_LIST } from "@/config/maps";
import {
  CONTROL_ZONE_IDS,
  CONTROL_ZONE_LABEL,
  type ControlZoneId,
  type MapId,
} from "@/lib/terrain/types";
import { LIGHTINGS, type Lighting, type SimPlayer } from "@/lib/admin-sim/types";
import { Select } from "./select";

/*
 * Dialogs behind the Live toolbar and the row actions menu (§4.8). Form state is cleared on
 * every close path (Cancel, X, Esc, backdrop, submit), so each opening starts blank.
 */

export interface Target {
  steamId: string;
  name: string;
}

export function WhisperDialog({
  target,
  onClose,
  onSend,
}: {
  target: Target | null;
  onClose: () => void;
  onSend: (steamId: string, text: string) => void;
}) {
  const [text, setText] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const close = () => {
    setText("");
    onClose();
  };
  const submit = () => {
    if (!target || !text.trim()) return;
    onSend(target.steamId, text.trim());
    close();
  };
  return (
    <Dialog
      open={target !== null}
      onClose={close}
      title={target ? `Whisper ${target.name}` : "Whisper"}
      description="Only they see it, as a direct message in-game."
      size="sm"
      initialFocusRef={ref}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!text.trim()}>
            Send
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Message" htmlFor="whisper-text">
          <Textarea
            ref={ref}
            rows={3}
            value={text}
            maxLength={240}
            onChange={(e) => setText(e.target.value)}
            placeholder="Watch the flank at Houses."
          />
        </Field>
      </form>
    </Dialog>
  );
}

export function BroadcastDialog({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const close = () => {
    setText("");
    onClose();
  };
  const submit = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    close();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Broadcast"
      description="Everyone on the server sees it."
      size="sm"
      initialFocusRef={ref}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!text.trim()}>
            Broadcast
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Message" htmlFor="broadcast-text">
          <Textarea
            ref={ref}
            rows={3}
            value={text}
            maxLength={240}
            onChange={(e) => setText(e.target.value)}
            placeholder="Map change in five minutes."
          />
        </Field>
      </form>
    </Dialog>
  );
}

export function KickDialog({
  target,
  onClose,
  onKick,
}: {
  target: Target | null;
  onClose: () => void;
  onKick: (steamId: string, reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <ConfirmDialog
      open={target !== null}
      onClose={close}
      onConfirm={() => {
        if (!target || !reason.trim()) return;
        onKick(target.steamId, reason.trim());
        close();
      }}
      title={target ? `Kick ${target.name}` : "Kick"}
      confirmLabel="Kick"
      tone="danger"
      body="They drop from the server now and can rejoin. On the demo server they come back on their own within a few minutes."
      reasonField={{
        label: "Reason (required, shown in the audit trail)",
        value: reason,
        onChange: setReason,
        required: true,
      }}
    />
  );
}

const DURATIONS: { label: string; minutes: number }[] = [
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
];

export function BanDialog({
  open,
  target,
  roster,
  onClose,
  onBan,
}: {
  open: boolean;
  /** Preselected player (from a row menu); null lets the visitor pick or type a steamId. */
  target: Target | null;
  roster: SimPlayer[];
  onClose: () => void;
  onBan: (steamId: string, reason: string, evidenceUrl: string | null, minutes: number) => void;
}) {
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [evidence, setEvidence] = React.useState("");
  const [minutes, setMinutes] = React.useState(60);
  const firstRef = React.useRef<HTMLTextAreaElement>(null);
  const steamId = target ? target.steamId : typed;
  const idOk = /^\d{17}$/.test(steamId.trim());
  const evidenceOk = evidence.trim() === "" || /^https:\/\/\S+$/.test(evidence.trim());
  const ready = idOk && reason.trim() !== "" && evidenceOk;
  const close = () => {
    setTyped("");
    setReason("");
    setEvidence("");
    setMinutes(60);
    onClose();
  };
  const submit = () => {
    if (!ready) return;
    onBan(steamId.trim(), reason.trim(), evidence.trim() || null, minutes);
    close();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={target ? `Ban ${target.name}` : "Ban a player"}
      description="Bans on the demo server are capped at six hours and lift on their own."
      size="md"
      initialFocusRef={target ? firstRef : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={!ready}>
            Ban for {DURATIONS.find((d) => d.minutes === minutes)?.label}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!target ? (
          <>
            <Field label="Pick from the roster" htmlFor="ban-pick">
              <Select
                value={roster.some((p) => p.steamId === typed) ? typed : ""}
                onChange={(e) => setTyped(e.target.value)}
              >
                <option value="">— type a SteamID64 below —</option>
                {[...roster]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((p) => (
                    <option key={p.steamId} value={p.steamId}>
                      {p.name} · {p.team}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field
              label="SteamID64"
              htmlFor="ban-steamid"
              error={typed && !idOk ? "A SteamID64 is 17 digits." : undefined}
            >
              <Input
                value={typed}
                inputMode="numeric"
                onChange={(e) => setTyped(e.target.value)}
                placeholder="76561198000000000"
                className="font-mono"
              />
            </Field>
          </>
        ) : null}
        <Field label="Reason (required)" htmlFor="ban-reason">
          <Textarea
            ref={firstRef}
            rows={2}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cheating, with the clip below."
          />
        </Field>
        <Field
          label="Evidence URL (optional, https only)"
          htmlFor="ban-evidence"
          error={!evidenceOk ? "Evidence links must start with https://" : undefined}
        >
          <Input
            type="url"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="https://"
          />
        </Field>
        <div>
          <p className="mb-2 label-mono text-fg-muted">Duration</p>
          <div className="flex gap-2" role="group" aria-label="Ban duration">
            {DURATIONS.map((d) => (
              <Chip
                key={d.minutes}
                selected={minutes === d.minutes}
                onClick={() => setMinutes(d.minutes)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </div>
      </form>
    </Dialog>
  );
}

export function MapDialog({
  open,
  current,
  onClose,
  onSet,
}: {
  open: boolean;
  current: { map: MapId; zone: ControlZoneId; lighting: Lighting };
  onClose: () => void;
  onSet: (map: MapId, zone: ControlZoneId, lighting: Lighting | null) => void;
}) {
  // null = "as it is now": the dialog always opens on the live values.
  const [map, setMap] = React.useState<MapId | null>(null);
  const [zone, setZone] = React.useState<ControlZoneId | null>(null);
  const [lighting, setLighting] = React.useState<Lighting | "">("");
  const close = () => {
    setMap(null);
    setZone(null);
    setLighting("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Override map"
      description="Changes the map now, until the next rotation entry."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSet(map ?? current.map, zone ?? current.zone, lighting || null);
              close();
            }}
          >
            Change map
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Map" htmlFor="map-map">
          <Select value={map ?? current.map} onChange={(e) => setMap(e.target.value as MapId)}>
            {MAP_LIST.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Control zone" htmlFor="map-zone">
          <Select
            value={zone ?? current.zone}
            onChange={(e) => setZone(e.target.value as ControlZoneId)}
          >
            {CONTROL_ZONE_IDS.filter((z) => z !== "none").map((z) => (
              <option key={z} value={z}>
                {CONTROL_ZONE_LABEL[z]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lighting" htmlFor="map-lighting">
          <Select value={lighting} onChange={(e) => setLighting(e.target.value as Lighting | "")}>
            <option value="">Keep {current.lighting}</option>
            {LIGHTINGS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

export function LightingDialog({
  open,
  current,
  onClose,
  onSet,
}: {
  open: boolean;
  current: Lighting;
  onClose: () => void;
  onSet: (value: Lighting) => void;
}) {
  const [picked, setPicked] = React.useState<Lighting | null>(null);
  const value = picked ?? current;
  const close = () => {
    setPicked(null);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Set lighting"
      description="Applies live and holds until the next rotation entry."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSet(value);
              close();
            }}
            disabled={value === current}
          >
            Set lighting
          </Button>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 label-mono text-fg-muted">Preset</legend>
        {LIGHTINGS.map((l) => (
          <label
            key={l}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2.5 text-sm text-fg has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input
              type="radio"
              name="lighting"
              value={l}
              checked={value === l}
              onChange={() => setPicked(l)}
              className="accent-[var(--accent)]"
            />
            {l}
            {l === current ? (
              <span className="ml-auto font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
                now
              </span>
            ) : null}
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}

export function otherTeams(team: Team): Team[] {
  return site.game.teams.filter((t) => t !== team);
}
