"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardPanelId = "live" | "rotation" | "history" | "bans" | "audit";

/** The static shell for every tab while the panel chunk lands (and with no JS at all). */
export function DashboardSkeleton({ panel }: { panel: DashboardPanelId }) {
  return (
    <div aria-busy="true" aria-label={`Loading the ${panel} panel`} className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      {panel === "live" ? <Skeleton className="h-64" /> : null}
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

/* The dashboard bundle (tables, dialogs, charts, the RCON sheet) loads only on dashboard routes. */
const DashboardPanel = dynamic(() => import("./dashboard").then((m) => m.DashboardPanel), {
  ssr: false,
  loading: () => <DashboardSkeleton panel="live" />,
});

/** Owns the `dynamic()` import (a `"use client"` file, §3.14) so server pages stay static shells. */
export function DashboardLoader({ panel }: { panel: DashboardPanelId }) {
  return <DashboardPanel panel={panel} />;
}
