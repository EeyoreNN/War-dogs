import { cn } from "@/lib/utils";

/** Loading placeholder block. Size it with `className` (e.g. `h-4 w-32`). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-bg-2", className)} />;
}
