"use client";

// New request (§4.3.4): kind chips (1–4 while open), priority, note, then "Place on map" (the
// next click places and creates) or "No location" (creates immediately).
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { announce } from "@/components/ui/live-region";
import { REQUEST_KINDS, type RequestKind, type RequestPriority } from "@/lib/map/types";
import { addRequest } from "./actions";
import { useMapApp } from "./context";
import { KindPriorityFields } from "./RequestsPanel";
import { useUiStore } from "./ui-store";

export function NewRequestDialog() {
  const open = useUiStore((s) => s.newRequestOpen);
  const uiSet = useUiStore((s) => s.set);
  const close = () => uiSet({ newRequestOpen: false });
  return (
    <Dialog open={open} onClose={close} title="New request" size="sm">
      {open ? <NewRequestForm onClose={close} /> : null}
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so the draft resets every time it opens. */
function NewRequestForm({ onClose }: { onClose: () => void }) {
  const uiSet = useUiStore((s) => s.set);
  const api = useUiStore((s) => s.viewportApi);
  const { isMobile } = useMapApp();
  const [kind, setKind] = React.useState<RequestKind>("fuel");
  const [priority, setPriority] = React.useState<RequestPriority>("normal");
  const [note, setNote] = React.useState("");
  return (
    <div
      onKeyDown={(e) => {
        if (/^[1-4]$/.test(e.key) && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          setKind(REQUEST_KINDS[Number(e.key) - 1]);
        }
      }}
    >
      <KindPriorityFields
        kind={kind}
        setKind={setKind}
        priority={priority}
        setPriority={setPriority}
        note={note}
        setNote={setNote}
        idPrefix="new"
      />
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            addRequest(kind, priority, note, null);
            onClose();
          }}
        >
          No location
        </Button>
        <Button
          onClick={() => {
            uiSet({ newRequestOpen: false, placingRequest: { kind, priority, note } });
            announce(
              isMobile
                ? "Tap the map to place the request."
                : "Click the map to place the request; Enter places it at the crosshair, Esc cancels.",
            );
            api?.focusMap();
          }}
        >
          Place on map
        </Button>
      </div>
    </div>
  );
}
