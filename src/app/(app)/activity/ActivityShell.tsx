"use client";

// /activity (§4.7): outside Discord → /demo with a toast; inside with a client id → the room for
// this voice channel instance; inside without a client id → the setup callout.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Callout } from "@/components/ui/callout";
import { toast } from "@/components/ui/toast";
import MapAppLoader from "@/components/map/MapAppLoader";
import { site } from "@/config/site";
import { isInsideDiscord } from "@/lib/realtime/discord-env";
import { codeFromInstance } from "@/lib/room/code";
import type { ActivityContext } from "@/lib/discord/activity";

type Phase =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "ready"; ctx: ActivityContext; code: string };

export function ActivityShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });

  React.useEffect(() => {
    let alive = true;
    if (!isInsideDiscord()) {
      toast(
        "Open this inside a Discord voice channel to share a room with the call. Here is the demo instead.",
      );
      router.replace("/demo");
      return;
    }
    const clientId = site.discord.clientId;
    const boot = clientId
      ? import("@/lib/discord/activity").then(({ initActivity }) => initActivity(clientId))
      : Promise.resolve(null);
    void boot.then((ctx) => {
      if (!alive) return;
      if (!ctx) setPhase({ kind: "unconfigured" });
      else setPhase({ kind: "ready", ctx, code: codeFromInstance(ctx.instanceId) });
    });
    return () => {
      alive = false;
    };
  }, [router]);

  if (phase.kind === "ready") {
    return (
      <MapAppLoader
        mode="activity"
        code={phase.code}
        activity={{ openExternal: phase.ctx.openExternal }}
      >
        {children}
      </MapAppLoader>
    );
  }
  if (phase.kind === "unconfigured") {
    return (
      <div className="mx-auto w-full max-w-[640px] px-6 py-16">
        <Callout tone="warning" title="This instance has no Discord app configured">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Create an application at discord.com/developers/applications.</li>
            <li>
              Under Activities, enable Activities and add a URL mapping: prefix / → your site origin
              (for example https://wardogs.example.com). If you run a relay, add a second mapping:
              prefix /relay → the relay origin.
            </li>
            <li>
              Under OAuth2, note the Client ID. Add applications.commands to the default install
              scopes. Enable both Guild Install and User Install.
            </li>
            <li>
              Set NEXT_PUBLIC_DISCORD_CLIENT_ID=&lt;client id&gt; in the site&apos;s environment and
              redeploy. If you run a relay, set NEXT_PUBLIC_RELAY_URL too, and add
              https://&lt;client id&gt;.discordsays.com to the relay&apos;s RELAY_ALLOWED_ORIGINS.
            </li>
            <li>In Discord, join a voice channel, press Start an Activity, pick your app.</li>
          </ol>
          <p className="mt-3">
            <Link href="/add">The setup page</Link> has the same steps.
          </p>
        </Callout>
      </div>
    );
  }
  return <>{children}</>;
}
