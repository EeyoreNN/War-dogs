import type { Metadata } from "next";
import { AppShellStatic, ShellMapArea } from "@/components/map/AppShell";
import MapAppLoader from "@/components/map/MapAppLoader";
import { MapPreview } from "@/components/map/MapPreview";
import { demoSeedState } from "@/lib/map/scenario";
import { DEMO_ROOM_CODE } from "@/lib/map/types";

export const metadata: Metadata = {
  title: "The live demo",
  description: "A shared map with people in it right now. No sign-in. Resets every five minutes.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "The live demo",
    description: "A shared map with people in it right now. No sign-in. Resets every five minutes.",
    url: "/demo",
  },
};

// Static server shell (§4.2): the seed plan is server-rendered and terrain comes by URL — the LCP
// element paints with JavaScript disabled. MapAppLoader mounts the live app in the same box.
export default function DemoPage() {
  return (
    <MapAppLoader mode="demo" code={DEMO_ROOM_CODE}>
      <AppShellStatic code={DEMO_ROOM_CODE} badge="Live demo" centre="Zestafona · Default">
        <ShellMapArea>
          <MapPreview
            state={demoSeedState(0)}
            priority
            title="The demo's seed plan on Zestafona"
            className="h-full w-full"
          />
        </ShellMapArea>
        <noscript>
          <p className="absolute inset-x-0 bottom-0 m-4 rounded-md border border-line-strong bg-bg-1/95 p-3 text-sm text-fg">
            The map needs JavaScript to be live. What you see is the seed plan; turn it on to draw
            with everyone else.
          </p>
        </noscript>
      </AppShellStatic>
    </MapAppLoader>
  );
}
