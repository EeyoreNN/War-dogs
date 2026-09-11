"use client";

// `DEMO · resets in 4:32` — ticks every second from the store clock (§4.2).
import { DEMO_EPOCH_MS, epochStart } from "@/lib/map/scenario";
import { Tooltip } from "@/components/ui/tooltip";
import { now } from "@/store/room";
import { useNow } from "../context";
import { formatClock } from "../lib/format";

const TIP =
  "Bots are scripted on a shared clock. Your edits are shared with tabs in this browser and, on a relay, with everyone — until the next reset.";

export function DemoClock({ compact = false }: { compact?: boolean }) {
  const t = useNow(1000, now);
  const left = (epochStart(t) + DEMO_EPOCH_MS - t) / 1000;
  return (
    <Tooltip label={TIP} side="bottom">
      <span
        tabIndex={0}
        aria-live="off"
        data-testid="demo-clock"
        className="inline-flex h-8 cursor-default items-center rounded-sm px-1 font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase tabular-nums"
      >
        {compact ? `resets ${formatClock(left)}` : `Demo · resets in ${formatClock(left)}`}
      </span>
    </Tooltip>
  );
}
