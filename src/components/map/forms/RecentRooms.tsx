"use client";

// The Rejoin list on /join (§4.5): tier-1 card, eyebrow `Rejoin`, rows as on Home.
import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardEyebrow } from "@/components/ui/card";
import { mapById } from "@/config/maps";
import type { RecentRoom } from "@/lib/map/types";
import { forgetRoom, listRecentRooms } from "@/lib/storage/rooms";
import { clockNow, useMounted, useNow } from "../context";
import { timeAgo } from "../lib/format";

export function RecentRooms() {
  const mounted = useMounted();
  const [forgotten, setForgotten] = React.useState<RecentRoom[] | null>(null);
  const now = useNow(60_000, clockNow);
  const rooms = React.useMemo(
    () => forgotten ?? (mounted ? listRecentRooms() : null),
    [forgotten, mounted],
  );
  if (!rooms || rooms.length === 0) return null;
  return (
    <Card className="mt-6 w-full max-w-[640px] p-5">
      <CardEyebrow>Rejoin</CardEyebrow>
      <ul className="mt-3 flex flex-col">
        {rooms.slice(0, 3).map((r) => (
          <li
            key={r.code}
            className="flex items-center gap-2 border-t border-line py-2 first:border-t-0"
          >
            <Link
              href={`/room/${r.code}`}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 rounded-sm text-[15px] text-fg hover:text-accent"
            >
              <span className="font-mono font-medium tracking-[0.1em]">{r.code}</span>
              <span className="text-fg-muted">
                · {r.team} · {mapById(r.map)?.name ?? r.map} · {timeAgo(r.updatedAt, now)}
              </span>
            </Link>
            <Button
              variant="icon"
              size="icon"
              className="h-8 w-8"
              aria-label={`Forget ${r.code}`}
              onClick={() => setForgotten(forgetRoom(r.code))}
            >
              <X size={14} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
