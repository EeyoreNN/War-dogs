"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { MAP_LIST } from "@/config/maps";
import { SCORE_TICK_RANGE, mapName, zoneName } from "@/lib/admin-sim/engine";
import { LIGHTINGS, type Lighting, type SimState } from "@/lib/admin-sim/types";
import {
  CONTROL_ZONE_IDS,
  CONTROL_ZONE_LABEL,
  type ControlZoneId,
  type MapId,
} from "@/lib/terrain/types";
import { cn } from "@/lib/utils";
import { SectionHeading, Select } from "./select";
import { useAction } from "./sim-provider";

export function RotationPanel({ state }: { state: SimState }) {
  const act = useAction();
  const [adding, setAdding] = React.useState(false);
  const [map, setMap] = React.useState<MapId>("zestafona");
  const [zone, setZone] = React.useState<ControlZoneId>("default");
  const [lighting, setLighting] = React.useState<Lighting>("Day Clear");
  // null = showing the live value; a string while the visitor edits it.
  const [tickDraft, setTickDraft] = React.useState<string | null>(null);
  const tick = tickDraft ?? String(state.settings.scoreTick);
  const listRef = React.useRef<HTMLOListElement>(null);

  const moveEntry = (index: number, direction: "up" | "down") => {
    act({ t: "rotation.move", index, direction });
    // Keep focus on the same entry after it moves.
    const target = direction === "up" ? index - 1 : index + 1;
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-entry="${target}"] [data-move="${direction}"]`)
        ?.focus();
    });
  };

  const tickNum = Number(tick);
  const tickOk =
    Number.isInteger(tickNum) && tickNum >= SCORE_TICK_RANGE[0] && tickNum <= SCORE_TICK_RANGE[1];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="rotation-heading" className="panel p-4 sm:p-6">
        <SectionHeading
          title="Map rotation"
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAdding((v) => !v)}
                aria-expanded={adding}
                aria-controls="rotation-add"
              >
                <Plus size={14} aria-hidden="true" /> Add entry
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  act({ t: "rotation.save" });
                  toast("Saved to ServerSettings.ini (simulated)", { tone: "ok" });
                }}
              >
                <Save size={14} aria-hidden="true" /> Save
              </Button>
            </>
          }
        >
          <span id="rotation-heading">
            {state.rotation.length} entries, played in order. Match {state.match.n} is on entry{" "}
            {state.rotationIndex + 1}.
          </span>
        </SectionHeading>

        {adding ? (
          <form
            id="rotation-add"
            className="mt-4 grid gap-4 rounded-md border border-line bg-bg-0/60 p-4 sm:grid-cols-3 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              act({
                t: "rotation.add",
                entry: { map, experiences: ["King of the Hill"], lighting, zoneAlternator: zone },
              });
              toast(`${mapName(map)} added to the rotation. Save to keep it.`, { tone: "ok" });
              setAdding(false);
            }}
          >
            <Field label="Map" htmlFor="rot-map">
              <Select value={map} onChange={(e) => setMap(e.target.value as MapId)}>
                {MAP_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Control zone" htmlFor="rot-zone">
              <Select value={zone} onChange={(e) => setZone(e.target.value as ControlZoneId)}>
                {CONTROL_ZONE_IDS.filter((z) => z !== "none").map((z) => (
                  <option key={z} value={z}>
                    {CONTROL_ZONE_LABEL[z]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lighting" htmlFor="rot-light">
              <Select value={lighting} onChange={(e) => setLighting(e.target.value as Lighting)}>
                {LIGHTINGS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" size="sm">
                Add to rotation
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <ol ref={listRef} className="mt-4 flex flex-col gap-2" aria-label="Rotation entries">
          {state.rotation.map((e, i) => (
            <li
              key={`${i}-${e.map}-${e.zoneAlternator}-${e.lighting}`}
              data-entry={i}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5",
                e.status === "now" ? "border-accent/50 bg-accent-soft" : "border-line bg-bg-0/40",
              )}
            >
              <span className="w-6 font-mono text-[12px] text-fg-faint tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-fg">
                  <span className="font-semibold">{mapName(e.map)}</span>
                  {e.status === "now" ? (
                    <Badge tone="accent">Now</Badge>
                  ) : e.status === "next" ? (
                    <Badge tone="muted">Next</Badge>
                  ) : null}
                  {e.denied ? <Badge tone="danger">Denied</Badge> : null}
                </p>
                <p className="mt-0.5 font-mono text-[12px] tracking-[0.04em] text-fg-muted">
                  {zoneName(e.zoneAlternator)} · {e.lighting} · {e.experiences.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={`Move ${mapName(e.map)} up`}
                  data-move="up"
                  disabled={i === 0}
                  onClick={() => moveEntry(i, "up")}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={`Move ${mapName(e.map)} down`}
                  data-move="down"
                  disabled={i === state.rotation.length - 1}
                  onClick={() => moveEntry(i, "down")}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="icon"
                  size="icon"
                  aria-label={`Remove ${mapName(e.map)} from slot ${i + 1}`}
                  disabled={state.rotation.length <= 1}
                  className="text-danger-text"
                  onClick={() => {
                    act({ t: "rotation.remove", index: i });
                    toast(`${mapName(e.map)} removed from slot ${i + 1}.`);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="settings-heading" className="panel p-4 sm:p-6">
        <SectionHeading title="Rotation settings">
          <span id="settings-heading">Each change is one PATCH /v1/settings.</span>
        </SectionHeading>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <label className="flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
              checked={state.settings.rotationEnabled}
              onChange={(e) => {
                act({ t: "settings.patch", patch: { rotationEnabled: e.target.checked } });
                toast(
                  e.target.checked
                    ? "Rotation enabled."
                    : "Rotation disabled; the current map repeats.",
                );
              }}
            />
            <span>
              Rotation enabled
              <span className="block text-fg-muted">
                Off means the server replays the current entry.
              </span>
            </span>
          </label>
          <div>
            <p className="mb-2 label-mono text-fg-muted">Mode</p>
            <div className="flex gap-2" role="group" aria-label="Rotation mode">
              {(["ordered", "random"] as const).map((mode) => (
                <Chip
                  key={mode}
                  selected={state.settings.rotationMode === mode}
                  onClick={() => {
                    if (state.settings.rotationMode === mode) return;
                    act({ t: "settings.patch", patch: { rotationMode: mode } });
                    toast(`Rotation mode: ${mode}.`);
                  }}
                >
                  {mode === "ordered" ? "Ordered" : "Random"}
                </Chip>
              ))}
            </div>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!tickOk || tickNum === state.settings.scoreTick) return;
              act({ t: "settings.patch", patch: { scoreTick: tickNum } });
              setTickDraft(null);
              toast(`Score tick set to ${tickNum} s.`, { tone: "ok" });
            }}
          >
            <Field
              label={`Score tick (${SCORE_TICK_RANGE[0]}–${SCORE_TICK_RANGE[1]} s)`}
              htmlFor="score-tick"
              error={
                tick && !tickOk
                  ? `Use a whole number from ${SCORE_TICK_RANGE[0]} to ${SCORE_TICK_RANGE[1]}.`
                  : undefined
              }
              className="flex-1"
            >
              <Input
                type="number"
                inputMode="numeric"
                min={SCORE_TICK_RANGE[0]}
                max={SCORE_TICK_RANGE[1]}
                value={tick}
                onChange={(e) => setTickDraft(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              className="h-12"
              disabled={!tickOk || tickNum === state.settings.scoreTick}
            >
              Apply
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
