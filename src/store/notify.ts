// The store's one door to the UI: toasts (and the live region behind them). Swappable in tests.
import { toast } from "@/components/ui/toast";

export type NoticeTone = "default" | "ok" | "warn" | "danger";
export type Notifier = (message: string, tone?: NoticeTone) => void;

let notifier: Notifier = (message, tone) => toast(message, { tone });

export function notify(message: string, tone: NoticeTone = "default"): void {
  try {
    notifier(message, tone);
  } catch {
    /* never let a toast break a dispatch */
  }
}

export function setNotifier(fn: Notifier | null): void {
  notifier = fn ?? ((message, tone) => toast(message, { tone }));
}

export const COPY = {
  corruptSnapshot: "Saved plan could not be read; starting fresh",
  storageFull: "Browser storage is full; this room will not persist",
  trimmed: "Older ink was dropped so the plan fits browser storage.",
  relayUnreachable: "Relay unreachable — this browser only.",
  rateLimit: "Slow down — the relay is dropping edits.",
  badFrame: "An edit was rejected by the relay.",
  canDrawNow: "You can draw now",
  drawDenied: "The commander said not right now",
  askedToDraw: "Asked. The commander will see it in the Roster.",
  mapMismatch: "Commander's map did not verify; asking again.",
} as const;
