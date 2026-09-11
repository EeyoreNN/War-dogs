"use client";

import * as React from "react";
import { createSimBridge, type SimBridge } from "@/lib/admin-sim/bridge";
import { DEFAULT_SEED, stateAt } from "@/lib/admin-sim/engine";
import { loadShowRcon, loadVisitor, saveCallsign, saveShowRcon } from "@/lib/admin-sim/identity";
import type { AdminCommand, AuditEntry, SimState, TimedCommand } from "@/lib/admin-sim/types";

/**
 * One simulation per browser tab: a 1 Hz clock (paused while the tab is hidden), the shared
 * command log (localStorage + BroadcastChannel, §4.8) and the visitor's callsign. Every
 * consumer reads `state = stateAt(DEFAULT_SEED, now, commands, me)`, so two tabs agree.
 *
 * The clock, bridge and identity live in a small external store read through
 * `useSyncExternalStore`: the server snapshot is `null`, so static shells hydrate with their
 * Skeleton and switch to the live state after the first subscription.
 */

interface Snapshot {
  now: number;
  commands: TimedCommand[];
  me: string;
  showRcon: boolean;
  storageOk: boolean;
}

interface SimStore {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => Snapshot | null;
  push: (cmd: AdminCommand) => TimedCommand | null;
  setCallsign: (callsign: string) => void;
  setShowRcon: (v: boolean) => void;
}

function createSimStore(): SimStore {
  let bridge: SimBridge | null = null;
  let snapshot: Snapshot | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeBridge: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const refresh = (patch: Partial<Snapshot> = {}) => {
    if (!bridge) return;
    snapshot = {
      now: Date.now(),
      commands: bridge.commands(),
      me: snapshot?.me ?? "",
      showRcon: snapshot?.showRcon ?? true,
      storageOk: bridge.storageOk,
      ...patch,
    };
    emit();
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(() => refresh(), 1000);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const onVisibility = () => {
    if (document.hidden) stop();
    else {
      bridge?.reload();
      refresh();
      start();
    }
  };

  const open = () => {
    bridge = createSimBridge();
    unsubscribeBridge = bridge.subscribe(() => refresh());
    refresh({ me: loadVisitor().callsign, showRcon: loadShowRcon() });
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();
  };
  const close = () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
    unsubscribeBridge?.();
    unsubscribeBridge = null;
    bridge?.close();
    bridge = null;
    snapshot = null;
  };

  return {
    subscribe(cb) {
      listeners.add(cb);
      if (listeners.size === 1) open();
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0) close();
      };
    },
    getSnapshot: () => snapshot,
    push(cmd) {
      if (!bridge || !snapshot) return null;
      const timed = bridge.push(cmd, snapshot.me);
      refresh();
      return timed;
    },
    setCallsign(callsign) {
      refresh({ me: saveCallsign(callsign).callsign });
    },
    setShowRcon(v) {
      saveShowRcon(v);
      refresh({ showRcon: v });
    },
  };
}

export interface SimContextValue {
  /** null until the client mounts (the static shell renders a Skeleton meanwhile). */
  state: SimState | null;
  now: number;
  me: string;
  setCallsign: (callsign: string) => void;
  /** Append a command as the visitor; returns the timed command as stored. */
  push: (cmd: AdminCommand) => TimedCommand | null;
  /** Discard every visitor command (a `reset` command, audited as local only). */
  reset: () => void;
  storageOk: boolean;
  /** "What this sends" sheet. */
  sheet: { open: boolean; entry: AuditEntry | null };
  openSheet: (entry: AuditEntry) => void;
  closeSheet: () => void;
  showRcon: boolean;
  setShowRcon: (v: boolean) => void;
}

const SimContext = React.createContext<SimContextValue | null>(null);

export function useSim(): SimContextValue {
  const ctx = React.useContext(SimContext);
  if (!ctx) throw new Error("useSim() needs a <SimProvider> above it");
  return ctx;
}

/** True when a provider is already mounted above (so nested providers can defer to it). */
export function useHasSim(): boolean {
  return React.useContext(SimContext) !== null;
}

export function SimProvider({
  children,
  seed = DEFAULT_SEED,
}: {
  children: React.ReactNode;
  seed?: number;
}) {
  const outer = React.useContext(SimContext);
  if (outer) return <>{children}</>;
  return <SimRoot seed={seed}>{children}</SimRoot>;
}

const getServerSnapshot = () => null;

function SimRoot({ children, seed }: { children: React.ReactNode; seed: number }) {
  const [store] = React.useState(createSimStore);
  const snap = React.useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  const [sheet, setSheet] = React.useState<SimContextValue["sheet"]>({ open: false, entry: null });

  const state = React.useMemo(
    () => (snap ? stateAt(seed, snap.now, snap.commands, snap.me) : null),
    [seed, snap],
  );

  const reset = React.useCallback(() => {
    store.push({ t: "reset" });
  }, [store]);
  const openSheet = React.useCallback((entry: AuditEntry) => setSheet({ open: true, entry }), []);
  const closeSheet = React.useCallback(() => setSheet((s) => ({ ...s, open: false })), []);

  const value = React.useMemo<SimContextValue>(
    () => ({
      state,
      now: snap?.now ?? 0,
      me: snap?.me ?? "",
      setCallsign: store.setCallsign,
      push: store.push,
      reset,
      storageOk: snap?.storageOk ?? true,
      sheet,
      openSheet,
      closeSheet,
      showRcon: snap?.showRcon ?? true,
      setShowRcon: store.setShowRcon,
    }),
    [state, snap, store, reset, sheet, openSheet, closeSheet],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

/**
 * Push a command and, when the preference allows, open the "What this sends" sheet on the
 * audit row it produced. Returns the audit entry stub (the sheet re-reads the live row by id).
 */
export function useAction() {
  const { push, openSheet, showRcon } = useSim();
  return React.useCallback(
    (cmd: AdminCommand, opts: { sheet?: boolean } = {}) => {
      const timed = push(cmd);
      if (!timed) return null;
      const entry: AuditEntry = {
        id: timed.id,
        at: timed.at,
        actor: timed.actor,
        mine: true,
        action: timed.cmd.t,
        target: null,
        result: "ok",
        detail: "",
        rcon: null,
      };
      if (opts.sheet ?? showRcon) openSheet(entry);
      return entry;
    },
    [push, openSheet, showRcon],
  );
}
