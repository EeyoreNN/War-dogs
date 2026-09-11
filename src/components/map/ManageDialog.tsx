"use client";

// Manage (§4.3.6): command roles only. Tabs Map / Squads / Access / Plan / Room.
import * as React from "react";
import { Download, FileJson, FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CopyButton } from "@/components/ui/copy-button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { announce } from "@/components/ui/live-region";
import { RadioCards } from "@/components/ui/radio-cards";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { MAP_LIST, mapById } from "@/config/maps";
import { site } from "@/config/site";
import { exportPng } from "@/lib/map/export-png";
import { formatPlanDate, planToSnapshot, planToText } from "@/lib/map/plan";
import { parseSnapshot } from "@/lib/map/schema";
import {
  MAX_SQUADS,
  SQUAD_NAME_LENGTH,
  type LayerId,
  type NodeType,
  type RoomSnapshot,
} from "@/lib/map/types";
import { CONTROL_ZONE_IDS, CONTROL_ZONE_LABEL } from "@/lib/terrain/types";
import { terrainUrl } from "@/lib/terrain/url";
import { cn } from "@/lib/utils";
import { now, useRoomStore } from "@/store/room";
import { clearLayer, loadPlan, updateSettings } from "./actions";
import { useMapApp } from "./context";
import { copyText, downloadBlob } from "./lib/download";
import { exportStem } from "./lib/format";
import { useUiStore, type ManageTab } from "./ui-store";
import { UploadMap } from "./UploadMap";

const TABS: { value: ManageTab; label: string }[] = [
  { value: "map", label: "Map" },
  { value: "squads", label: "Squads" },
  { value: "access", label: "Access" },
  { value: "plan", label: "Plan" },
  { value: "room", label: "Room" },
];

export function ManageDialog() {
  const open = useUiStore((s) => s.manageOpen);
  const tab = useUiStore((s) => s.manageTab);
  const uiSet = useUiStore((s) => s.set);
  const settings = useRoomStore((s) => s.state?.settings ?? null);
  if (!settings) return null;
  return (
    <Dialog
      open={open}
      onClose={() => uiSet({ manageOpen: false })}
      title="Manage war room"
      size="lg"
    >
      <Tabs
        aria-label="Manage"
        value={tab}
        onChange={(v) => uiSet({ manageTab: v as ManageTab })}
        items={TABS}
        className="mb-4"
      />
      <TabPanel value="map" active={tab}>
        <MapTab />
      </TabPanel>
      <TabPanel value="squads" active={tab}>
        <SquadsTab />
      </TabPanel>
      <TabPanel value="access" active={tab}>
        <AccessTab />
      </TabPanel>
      <TabPanel value="plan" active={tab}>
        <PlanTab />
      </TabPanel>
      <TabPanel value="room" active={tab}>
        <RoomTab />
      </TabPanel>
    </Dialog>
  );
}

function MapTab() {
  const settings = useRoomStore((s) => s.state!.settings);
  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Map" className="grid grid-cols-3 gap-3">
        {MAP_LIST.map((m) => {
          const selected = settings.map === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => updateSettings({ map: m.id })}
              className={cn(
                "group relative overflow-hidden rounded-md border border-line-strong bg-bg-0 text-left transition-colors hover:border-line-hi",
                selected && "border-accent ring-2 ring-accent",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- terrain SVG route */}
              <img
                src={terrainUrl(m.id, { size: 320, zone: settings.controlZone, labels: false })}
                alt={`${m.name} — ${m.blurb}`}
                width={320}
                height={320}
                className="aspect-square w-full object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded-sm bg-bg-0/80 px-1.5 eyebrow">
                {m.name}
              </span>
            </button>
          );
        })}
      </div>
      <div>
        <p className="mb-2 label-mono">Control zone</p>
        <div role="radiogroup" aria-label="Control zone" className="flex flex-wrap gap-2">
          {CONTROL_ZONE_IDS.map((z) => (
            <Button
              key={z}
              variant="chip"
              role="radio"
              aria-checked={settings.controlZone === z}
              active={settings.controlZone === z}
              onClick={() => updateSettings({ controlZone: z })}
            >
              {CONTROL_ZONE_LABEL[z]}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          Changing the map keeps your markers where they are; positions are relative.
        </p>
      </div>
      <div className="border-t border-line pt-4">
        <p className="mb-2 label-mono">Upload your own map</p>
        <UploadMap />
      </div>
    </div>
  );
}

function SquadsTab() {
  const settings = useRoomStore((s) => s.state!.settings);
  const state = useRoomStore((s) => s.state!);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [removing, setRemoving] = React.useState<string | null>(null);
  const add = () => {
    const n = name.trim();
    if (n.length < SQUAD_NAME_LENGTH[0] || n.length > SQUAD_NAME_LENGTH[1]) {
      setError("2 to 16 characters.");
      return;
    }
    if (settings.squads.some((q) => q.toLowerCase() === n.toLowerCase())) {
      setError("That squad already exists.");
      return;
    }
    updateSettings({ squads: [...settings.squads, n] });
    setName("");
    setError(undefined);
  };
  const nodesOn = (q: string) =>
    state.order.filter((id) => state.nodes[id].layer === `squad:${q}`).length;
  const remove = (q: string, moveTo: "team" | "delete") => {
    const layer: LayerId = `squad:${q}`;
    if (moveTo === "team") {
      const ids = state.order.filter((id) => state.nodes[id].layer === layer);
      for (const id of ids)
        useRoomStore
          .getState()
          .dispatch({ t: "node.update", id, patch: { layer: "team" } }, { undoable: false });
    } else clearLayer(layer, null);
    updateSettings({ squads: settings.squads.filter((x) => x !== q) });
    setRemoving(null);
  };
  return (
    <div className="flex flex-col gap-5">
      <RadioCards
        name="squadMode"
        aria-label="Run squads?"
        columns={2}
        value={settings.squadMode ? "squads" : "shared"}
        onChange={(v) => updateSettings({ squadMode: v === "squads" })}
        options={[
          {
            value: "shared",
            title: "One shared map",
            body: "Everyone works on the same layer. Simple.",
          },
          {
            value: "squads",
            title: "Squad mode",
            body: "Each squad plans on its own layer. Only you and co-commanders mark the team map. Joiners are asked their squad.",
          },
        ]}
      />
      {settings.squadMode ? (
        <div>
          <p className="mb-2 label-mono">
            Squads ({settings.squads.length}/{MAX_SQUADS})
          </p>
          <ul className="flex flex-col gap-1">
            {settings.squads.map((q) => (
              <li
                key={q}
                className="flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm"
              >
                <span className="flex-1 text-fg">{q}</span>
                <span className="font-mono text-[11px] text-fg-muted">{nodesOn(q)} on layer</span>
                <Button
                  variant="icon"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Remove ${q}`}
                  onClick={() => (nodesOn(q) ? setRemoving(q) : remove(q, "delete"))}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          {settings.squads.length < MAX_SQUADS ? (
            <div className="mt-3 flex items-end gap-2">
              <Field label="Add a squad" htmlFor="squad-name" error={error} className="flex-1">
                <Input
                  value={name}
                  maxLength={16}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                  placeholder="Delta"
                  className="h-10"
                />
              </Field>
              <Button variant="secondary" onClick={add}>
                Add
              </Button>
            </div>
          ) : null}
          <p className="mt-2 text-sm text-fg-muted">
            No rename: layers are keyed by name. Remove and add instead.
          </p>
          <Dialog
            open={removing !== null}
            onClose={() => setRemoving(null)}
            title={`Remove ${removing ?? ""}?`}
            size="sm"
            footer={
              <>
                <Button variant="secondary" onClick={() => removing && remove(removing, "team")}>
                  Move to team map
                </Button>
                <Button variant="danger" onClick={() => removing && remove(removing, "delete")}>
                  Delete them
                </Button>
              </>
            }
          >
            Move its drawings to the team map or delete them?
          </Dialog>
        </div>
      ) : null}
    </div>
  );
}

function AccessTab() {
  const settings = useRoomStore((s) => s.state!.settings);
  return (
    <RadioCards
      name="drawAccess"
      aria-label="Who can draw and use the map?"
      columns={2}
      value={settings.drawAccess}
      onChange={(v) => updateSettings({ drawAccess: v })}
      options={[
        {
          value: "everyone",
          title: "Everyone",
          body: "Anyone in the room draws and places every marker.",
        },
        {
          value: "request",
          title: "By request",
          body: "Only you and co-commanders. People ask from a greyed tool; you approve in the Roster.",
        },
      ]}
    />
  );
}

function PlanTab() {
  const state = useRoomStore((s) => s.state!);
  const code = useRoomStore((s) => s.code ?? "");
  const api = useUiStore((s) => s.viewportApi);
  const uiSet = useUiStore((s) => s.set);
  const { mode } = useMapApp();
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState<RoomSnapshot | null>(null);
  const [mismatch, setMismatch] = React.useState<RoomSnapshot | null>(null);
  const [confirmClear, setConfirmClear] = React.useState<{
    label: string;
    types: NodeType[] | null;
  } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const mapName = mapById(state.settings.map)?.name ?? state.settings.map;
  const zone = CONTROL_ZONE_LABEL[state.settings.controlZone];
  const blocked = mode === "activity";

  const doExport = async () => {
    if (blocked) {
      uiSet({ downloadBlocked: true });
      return;
    }
    const svg = api?.exportSvgElement();
    const terrain = await api?.terrainForExport();
    if (!svg || !terrain) return;
    setBusy(true);
    try {
      const world = svg.querySelector<SVGGElement>('[data-export="world"]');
      const prev = world?.style.getPropertyValue("--inv");
      world?.style.setProperty("--inv", "2.5");
      let blob: Blob;
      try {
        blob = await exportPng(svg, terrain, {
          code,
          team: state.settings.team,
          map: mapName,
          zone,
          date: formatPlanDate(now()),
        });
      } finally {
        if (prev) world?.style.setProperty("--inv", prev);
        else world?.style.removeProperty("--inv");
      }
      downloadBlob(`${exportStem(code, now())}.png`, blob);
      announce("PNG exported");
    } catch {
      toast("The map could not be exported.", { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  const copyPlan = async () => {
    const text = planToText(state, mapName, now());
    if (await copyText(text)) toast("Plan copied — paste it in Discord", { tone: "ok" });
    else uiSet({ copyFallback: { title: "Copy this plan", text } });
  };
  const savePlan = () => {
    if (blocked) {
      uiSet({ downloadBlocked: true });
      return;
    }
    const json = JSON.stringify(planToSnapshot(state, now()));
    downloadBlob(`${exportStem(code, now())}.json`, new Blob([json], { type: "application/json" }));
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    let snap: RoomSnapshot | null = null;
    try {
      snap = parseSnapshot(JSON.parse(await file.text()));
    } catch {
      snap = null;
    }
    if (fileRef.current) fileRef.current.value = "";
    if (!snap) {
      toast("That file is not a wardogs plan.", { tone: "danger" });
      return;
    }
    if (snap.state.settings.map !== state.settings.map) setMismatch(snap);
    else setPending(snap);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="secondary"
          loading={busy}
          onClick={doExport}
          className="justify-start gap-2"
        >
          <Download size={16} aria-hidden="true" /> Export PNG
        </Button>
        <Button variant="secondary" onClick={copyPlan} className="justify-start gap-2">
          <FileJson size={16} aria-hidden="true" /> Copy plan as text
        </Button>
        <Button variant="secondary" onClick={savePlan} className="justify-start gap-2">
          <Download size={16} aria-hidden="true" /> Save plan (.json)
        </Button>
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          className="justify-start gap-2"
        >
          <FileUp size={16} aria-hidden="true" /> Load plan
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Load plan"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      <div className="border-t border-line pt-4">
        <p className="mb-2 label-mono">Clear</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClear({ label: "ink", types: ["stroke", "shape"] })}
          >
            Clear ink
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmClear({ label: "markers", types: ["marker"] })}
          >
            Clear markers
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmClear({ label: "everything", types: null })}
          >
            Clear everything
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmClear !== null}
        onClose={() => setConfirmClear(null)}
        onConfirm={() => {
          if (confirmClear) {
            const layers = new Set<LayerId>([
              "team",
              ...Object.values(state.nodes).map((n) => n.layer),
            ]);
            for (const layer of layers) clearLayer(layer, confirmClear.types);
          }
          setConfirmClear(null);
        }}
        title={`Clear ${confirmClear?.label ?? ""}?`}
        body="Everyone in the room sees it go. Undo brings your own removal back."
        confirmLabel="Clear"
        tone="danger"
      />
      <ConfirmDialog
        open={mismatch !== null}
        onClose={() => setMismatch(null)}
        onConfirm={() => {
          setPending(mismatch);
          setMismatch(null);
        }}
        title="Different map"
        body={`This plan was drawn on ${mismatch ? (mapById(mismatch.state.settings.map)?.name ?? mismatch.state.settings.map) : ""}; you are on ${mapName}. Load it anyway?`}
        confirmLabel="Load anyway"
      />
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Replace the current plan or merge into it?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (pending) loadPlan(pending, "merge");
                setPending(null);
              }}
            >
              Merge
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pending) loadPlan(pending, "replace");
                setPending(null);
              }}
            >
              Replace
            </Button>
          </>
        }
      >
        Replace clears every layer first; merge keeps what is here and adds the plan&apos;s nodes.
      </Dialog>
    </div>
  );
}

function RoomTab() {
  const code = useRoomStore((s) => s.code ?? "");
  const leave = useRoomStore((s) => s.leave);
  const { mode, go, rejoin } = useMapApp();
  const link = `${site.url}/join?code=${code}`;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 label-mono">Room link</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-sm bg-bg-2 px-2 py-1 font-mono text-[13px] text-fg">{link}</code>
          <CopyButton text={link} label="Copy link" variant="secondary" size="sm" />
        </div>
      </div>
      <Callout tone="warning">Never share your war room code with another team.</Callout>
      <div>
        <Button
          variant="danger"
          onClick={() => {
            if (mode === "activity") rejoin();
            else {
              leave();
              go("/");
            }
          }}
        >
          Leave room
        </Button>
      </div>
    </div>
  );
}
