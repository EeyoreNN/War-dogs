"use client";

// Per-mount app context: mode, code and the activity bridge (§3.13, §4.7). Room state comes from
// the store; UI state from the ui-store; this is the small set of props that never change.
import * as React from "react";
import type { MapAppProps } from "./MapApp";

export interface MapAppContextValue {
  mode: MapAppProps["mode"];
  code: string;
  activity: MapAppProps["activity"] | null;
  /** Navigate, or in activity mode do nothing / open externally (§4.7). */
  go(href: string): void;
  openExternal(url: string): void;
  isMobile: boolean;
  landscapePhone: boolean;
  reducedMotion: boolean;
  /** Re-open the join dialog (activity mode's "Leave room"). */
  rejoin(): void;
  /** Team / squad hints from the join link, for "Start a fresh plan here". */
  joinHint: { team?: string; squad?: string } | null;
}

export const MapAppContext = React.createContext<MapAppContextValue | null>(null);

export function useMapApp(): MapAppContextValue {
  const v = React.useContext(MapAppContext);
  if (!v) throw new Error("useMapApp outside MapApp");
  return v;
}

/** Matches a media query with SSR-safe defaults (no layout shift on hydrate: MapApp is client-only). */
export function useMediaQuery(query: string, initial = false): boolean {
  const subscribe = React.useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => initial,
  );
}

/** A ticking clock (ms) at `intervalMs`, from the store's `now()` so e2e can fake time. */
export function useNow(intervalMs: number, now: () => number): number {
  const [t, setT] = React.useState(() => now());
  React.useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, now]);
  return t;
}

const noopSubscribe = () => () => {};

/** false during SSR and hydration, true once mounted — for browser-only reads without an effect. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Wall clock without calling Date.now() inside a render body. */
export const clockNow = (): number => Date.now();
