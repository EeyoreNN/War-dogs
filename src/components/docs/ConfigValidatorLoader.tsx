"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** The validator's shape (textarea, two buttons) while the chunk lands (§4.9, §7.3). */
export function ConfigValidatorSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the config validator"
      className="not-prose flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-[19rem] w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="min-h-6" />
    </div>
  );
}

const ConfigValidator = dynamic(() => import("./ConfigValidator").then((m) => m.ConfigValidator), {
  ssr: false,
  loading: () => <ConfigValidatorSkeleton />,
});

/**
 * Owns the `dynamic()` import so `validateIni` (and `zod` behind it) stay out of the `(site)`
 * first load (§7.3). The `/dev` page stays a server component; the section copy and the
 * annotated template are static HTML around this island.
 */
export function ConfigValidatorLoader({ template }: { template: string }) {
  return <ConfigValidator template={template} />;
}
