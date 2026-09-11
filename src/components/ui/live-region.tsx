"use client";

import * as React from "react";

/*
 * The one polite live region on the page. `announce()` coalesces messages that arrive within
 * 300 ms into a single announcement; a zero-width toggle re-announces identical text.
 */
type Snapshot = { text: string; tick: number };

const COALESCE_MS = 300;
let snapshot: Snapshot = { text: "", tick: 0 };
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function flush() {
  timer = null;
  const text = queue.join(". ");
  queue = [];
  snapshot = { text, tick: snapshot.tick + 1 };
  listeners.forEach((l) => l());
}

export function announce(message: string): void {
  const text = message.trim();
  if (!text) return;
  queue.push(text);
  if (!timer) timer = setTimeout(flush, COALESCE_MS);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => snapshot;
const serverSnapshot: Snapshot = { text: "", tick: 0 };
const getServerSnapshot = () => serverSnapshot;

export function LiveRegion() {
  const { text, tick } = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
      {tick % 2 === 1 ? "​" : ""}
    </div>
  );
}
