"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Card, CardEyebrow } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "./logic";
import type { RecentRoom } from "@/lib/map/types";
import { forgetRoom, listRecentRooms } from "@/lib/storage/rooms";

const MAX_ROWS = 3;
const EMPTY: RecentRoom[] = [];

function titleCase(s: string) {
  return s ? s[0]!.toUpperCase() + s.slice(1).toLowerCase() : s;
}

/* A tiny external store over `wardogs:rooms`, so the list hydrates without a set-state effect. */
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedRooms: RecentRoom[] = EMPTY;

function readRooms(): RecentRoom[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem("wardogs:rooms");
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedRooms = raw ? listRecentRooms() : EMPTY;
  }
  return cachedRooms;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Rejoin card (§4.1): rendered only after hydration and only when this browser has opened a
 * war room before. Nothing is reserved for it, so it never shifts the layout above it.
 */
export function RecentRooms({ className }: { className?: string }) {
  const rooms = React.useSyncExternalStore(subscribe, readRooms, () => EMPTY);
  const now = React.useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => 0,
  );

  if (rooms.length === 0) return null;

  const forget = (code: string) => {
    forgetRoom(code);
    listeners.forEach((cb) => cb());
  };

  return (
    <Card className={cn("p-4", className)}>
      <CardEyebrow className="mb-2">Rejoin</CardEyebrow>
      <ul className="flex flex-col">
        {rooms.slice(0, MAX_ROWS).map((r) => (
          <li
            key={r.code}
            className="flex items-center gap-2 border-t border-line first:border-t-0"
          >
            <Link
              href={`/room/${r.code}`}
              className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-2 py-2 text-sm text-fg-muted transition-colors hover:text-fg"
            >
              <span className="font-mono text-[13px] font-medium tracking-[0.12em] text-fg">
                {r.code}
              </span>
              <span aria-hidden="true">·</span>
              <span>{titleCase(r.team)}</span>
              <span aria-hidden="true">·</span>
              <span>{titleCase(r.map)}</span>
              <span aria-hidden="true">·</span>
              <span className="text-fg-faint">{formatRelativeTime(r.updatedAt, now)}</span>
            </Link>
            <button
              type="button"
              aria-label={`Forget ${r.code}`}
              onClick={() => forget(r.code)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-2 hover:text-fg"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
