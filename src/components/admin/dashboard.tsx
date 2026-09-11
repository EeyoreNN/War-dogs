"use client";

import { AuditPanel } from "./audit-panel";
import { BansPanel } from "./bans-panel";
import { DashboardSkeleton, type DashboardPanelId } from "./dashboard-loader";
import { HistoryPanel } from "./history-panel";
import { LivePanel } from "./live-panel";
import { RconSheet } from "./rcon-sheet";
import { RotationPanel } from "./rotation-panel";
import { useSim } from "./sim-provider";

/** The dashboard chunk: one panel per route plus the shared "What this sends" sheet. */
export function DashboardPanel({ panel }: { panel: DashboardPanelId }) {
  const { state } = useSim();
  // `data-bundle` is the marker `scripts/check-bundle.mjs` finds this chunk by (§7.3);
  // `contents` keeps the wrapper out of the layout.
  return (
    <div data-bundle="wd:dashboard" className="contents">
      {state ? (
        <>
          {panel === "live" ? <LivePanel state={state} /> : null}
          {panel === "rotation" ? <RotationPanel state={state} /> : null}
          {panel === "history" ? <HistoryPanel state={state} /> : null}
          {panel === "bans" ? <BansPanel state={state} /> : null}
          {panel === "audit" ? <AuditPanel state={state} /> : null}
          <RconSheet />
        </>
      ) : (
        <DashboardSkeleton panel={panel} />
      )}
    </div>
  );
}
