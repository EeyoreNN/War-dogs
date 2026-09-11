"use client";

import * as React from "react";
import { ExternalLink, ShieldBan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { SimState } from "@/lib/admin-sim/types";
import { cn } from "@/lib/utils";
import { BanDialog } from "./action-dialogs";
import { humanDuration, timeOfDay } from "./format";
import { SectionHeading, td, tdNum, th, thNum, zebra } from "./select";
import { useAction } from "./sim-provider";

export function BansPanel({ state }: { state: SimState }) {
  const act = useAction();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title={`Active bans · ${state.bans.length}`}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <ShieldBan size={14} aria-hidden="true" /> Ban a player…
          </Button>
        }
      >
        Every ban carries who placed it, why, and the evidence. Demo bans lift on their own; the
        countdown is live.
      </SectionHeading>

      <div className="relative overflow-x-auto panel p-4 sm:p-6">
        {state.bans.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">
            No active bans. Bans you place here expire in an hour by default and never reach a real
            player.
          </p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="bans-table">
            <caption className="sr-only">Active bans</caption>
            <thead>
              <tr className="label-mono text-fg-faint">
                <th scope="col" className={th}>
                  Player
                </th>
                <th scope="col" className={thNum}>
                  Remaining
                </th>
                <th scope="col" className={th}>
                  Reason
                </th>
                <th scope="col" className={th}>
                  Evidence
                </th>
                <th scope="col" className={th}>
                  Placed
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.bans.map((b) => {
                const remaining = b.expiresAt - state.now;
                return (
                  <tr
                    key={`${b.steamId}-${b.bannedAtUtc}`}
                    className={zebra}
                    data-steamid={b.steamId}
                  >
                    <td className={cn(td, "text-fg")}>
                      <span className="font-medium">{b.name}</span>
                      <span className="block font-mono text-[11px] text-fg-faint">{b.steamId}</span>
                    </td>
                    <td
                      className={cn(tdNum, remaining < 5 * 60_000 ? "text-warn" : "text-fg")}
                      aria-live="off"
                      data-testid="ban-countdown"
                    >
                      {humanDuration(remaining)}
                    </td>
                    <td className={cn(td, "max-w-[280px] text-fg-muted")}>{b.reason}</td>
                    <td className={td}>
                      {b.evidenceUrl ? (
                        <a
                          href={b.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-fg underline underline-offset-4 hover:text-accent"
                        >
                          Open <ExternalLink size={12} aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="text-fg-faint">none</span>
                      )}
                    </td>
                    <td className={cn(td, "text-fg-muted")}>
                      <span className="font-mono text-[12px]">
                        {timeOfDay(Date.parse(b.bannedAtUtc))}
                      </span>
                      <span className="block text-xs">by {b.bannedBy}</span>
                    </td>
                    <td className="py-1 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          act({ t: "unban", steamId: b.steamId });
                          toast(`Ban lifted for ${b.name}.`, { tone: "ok" });
                        }}
                      >
                        Unban
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <BanDialog
        open={open}
        target={null}
        roster={state.players}
        onClose={() => setOpen(false)}
        onBan={(steamId, reason, evidenceUrl, minutes) => {
          act({ t: "ban", steamId, reason, evidenceUrl, minutes });
          toast("Ban placed. It lifts on its own when the countdown ends.", { tone: "ok" });
        }}
      />
    </div>
  );
}
