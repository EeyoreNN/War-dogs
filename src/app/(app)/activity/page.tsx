import type { Metadata } from "next";
import { ActivityShell } from "./ActivityShell";

export const metadata: Metadata = {
  title: "Activity",
  description: "The war room for this Discord voice channel.",
  robots: { index: false, follow: false },
};

// Static shell (§4.7): the Discord SDK is loaded by ActivityShell alone, after mount.
export default function ActivityPage() {
  return (
    <ActivityShell>
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="flex items-center gap-3 font-mono text-[12px] tracking-[0.14em] text-fg-muted uppercase">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse-slow rounded-full bg-accent" />
          Loading the war room for this call…
        </p>
      </div>
    </ActivityShell>
  );
}
