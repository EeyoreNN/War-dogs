"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** The two-column console shell while the chunk lands (§4.9). */
export function ConsoleSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the API console" className="flex flex-col gap-6">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="h-[480px]" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}

const ApiConsole = dynamic(() => import("./ApiConsole").then((m) => m.ApiConsole), {
  ssr: false,
  loading: () => <ConsoleSkeleton />,
});

/** Owns the `dynamic()` import so the `(site)` first load stays inside budget (§4.9). */
export function ConsoleLoader({ configText }: { configText?: string }) {
  return <ApiConsole configText={configText} />;
}
