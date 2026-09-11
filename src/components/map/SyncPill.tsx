"use client";

// The honest three-state sync pill (§1, §4.3.2): LIVE · n in room / LOCAL · this browser /
// RECONNECTING… (+ CONNECTING… for the first seconds). Never a fake LIVE.
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRoomStore } from "@/store/room";

export function SyncPill({ compact = false }: { compact?: boolean }) {
  const sync = useRoomStore((s) => s.sync);
  const peers = useRoomStore((s) => s.peers);
  const queued = useRoomStore((s) => s.queued);
  const strikes = useRoomStore((s) => s.rateLimitStrikes);

  let tone: "ok" | "warn" | "danger" | "muted" = "muted";
  let text = "Connecting…";
  let tip = "Connecting to the relay.";
  let dot = "bg-fg-faint";
  switch (sync) {
    case "live":
      tone = "ok";
      text = compact ? "Live" : `Live · ${peers} in room`;
      tip = "Connected to the relay. Everyone with the code sees this map.";
      dot = "bg-ok animate-pulse-slow";
      break;
    case "local":
      tone = "warn";
      text = compact ? "Local" : "Local · this browser";
      tip =
        "No relay configured. Tabs in this browser share the map; other devices do not. Set NEXT_PUBLIC_RELAY_URL to go live.";
      dot = "bg-warn";
      break;
    case "reconnecting":
    case "offline":
      tone = "danger";
      text = "Reconnecting…";
      tip = `Relay connection dropped. Your edits are queued (${queued}) and will send when it returns.${strikes ? ` Rate-limit strikes: ${strikes}.` : ""}`;
      dot = "bg-danger animate-blink";
      break;
    default:
      break;
  }
  if (sync === "live" && strikes) tip += ` Rate-limit strikes: ${strikes}.`;

  return (
    <Tooltip label={tip} side="bottom">
      <Badge
        tone={tone}
        data-testid="sync-pill"
        data-sync={sync}
        tabIndex={0}
        className={cn("h-7 cursor-default", sync === "live" && "scanlines")}
      >
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        <span aria-live="off">{text}</span>
      </Badge>
    </Tooltip>
  );
}
