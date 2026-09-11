"use client";

// The scripted bot director (§4.2, §5.6): boots the store with `stateAt(now)` and the relay room
// `demoRelayRoom(now)`, schedules the remaining timeline items, feeds bot presence every 10 s and
// rolls to the next epoch's seed and room at the boundary. Time comes from the store clock so
// Playwright can fake it (`window.__wardogs.now`).
import * as React from "react";
import { announce } from "@/components/ui/live-region";
import { newId } from "@/lib/map/ids";
import {
  botPresence,
  DEMO_EPOCH_MS,
  DEMO_TIMELINE,
  demoRelayRoom,
  epochIndex,
  epochStart,
  stateAt,
  timelineOps,
} from "@/lib/map/scenario";
import { DEMO_ROOM_CODE, type Identity, type Ping } from "@/lib/map/types";
import { now, useRoomStore } from "@/store/room";
import { useUiStore } from "../ui-store";

export const PRESENCE_MS = 10_000;
export const DEMO_PING_MS = 4_000;

export function useDemoDirector(identity: Identity | null, enabled: boolean): void {
  React.useEffect(() => {
    if (!enabled || !identity) return;
    let alive = true;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let currentEpoch = -1;
    const store = useRoomStore.getState;

    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const firePing = (item: Extract<(typeof DEMO_TIMELINE)[number], { kind: "ping" }>) => {
      const ping: Ping = { ...item.ping, id: newId(), ts: now() };
      useUiStore.getState().set({ demoPings: [...useUiStore.getState().demoPings, ping] });
      timers.push(
        setTimeout(() => {
          useUiStore
            .getState()
            .set({ demoPings: useUiStore.getState().demoPings.filter((p) => p.id !== ping.id) });
        }, DEMO_PING_MS),
      );
      announce(`${item.ping.byName} pinged`);
    };

    /** Apply every op due by `t` (idempotent by rev) and schedule the rest. */
    const schedule = () => {
      clear();
      const t = now();
      const idx = epochIndex(t);
      const start = epochStart(t);
      const ops = timelineOps(idx);
      let opI = 0;
      for (const item of DEMO_TIMELINE) {
        const delay = start + item.at - t;
        if (item.kind === "op") {
          const op = ops[opI++];
          if (delay <= 0) store().ingest(op);
          else timers.push(setTimeout(() => alive && store().ingest(op), delay));
        } else if (delay > 0) timers.push(setTimeout(() => alive && firePing(item), delay));
      }
      timers.push(
        setTimeout(() => alive && void startEpoch(), Math.max(0, start + DEMO_EPOCH_MS - t) + 20),
      );
    };

    const startEpoch = async () => {
      const t = now();
      const idx = epochIndex(t);
      if (idx === currentEpoch) return;
      currentEpoch = idx;
      const { state } = stateAt(t);
      useUiStore.getState().set({ demoPings: [] });
      await store().boot({
        code: DEMO_ROOM_CODE,
        mode: "demo",
        identity,
        room: demoRelayRoom(t),
        seed: state,
      });
      if (!alive) return;
      store().ingestPresence(botPresence(now()));
      schedule();
    };

    const presence = setInterval(() => {
      if (alive) store().ingestPresence(botPresence(now()));
    }, PRESENCE_MS);
    const onVisible = () => {
      if (!alive || document.visibilityState !== "visible") return;
      if (epochIndex(now()) !== currentEpoch) void startEpoch();
      else schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    void startEpoch();

    return () => {
      alive = false;
      clear();
      clearInterval(presence);
      document.removeEventListener("visibilitychange", onVisible);
      useUiStore.getState().set({ demoPings: [] });
    };
  }, [enabled, identity]);
}
