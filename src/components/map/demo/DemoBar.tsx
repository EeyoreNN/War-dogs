"use client";

// Demo extras (§4.2): the sticky "open your own" bar above the zoom stack (desktop), `Clear mine`,
// and the always-visible schematic note.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { useRoomStore } from "@/store/room";
import { useMapApp } from "../context";

export function DemoBar() {
  const clearMine = useRoomStore((s) => s.clearMine);
  const { activity } = useMapApp();
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {!activity ? (
        <Link
          href="/create?map=zestafona&zone=default"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-accent/50 bg-bg-1/95 px-3 text-[13px] font-semibold text-fg shadow-panel backdrop-blur hover:border-accent hover:bg-bg-2"
        >
          Like it? Open your own war room →
        </Link>
      ) : null}
      <Tooltip
        label="Removes everything you added. Bots and other visitors are untouched."
        side="left"
      >
        <Button
          variant="ghost"
          size="sm"
          className="bg-bg-1/90 backdrop-blur"
          onClick={() => {
            const n = clearMine();
            toast(n ? "Your edits were removed." : "Nothing of yours to remove.");
          }}
        >
          Clear mine
        </Button>
      </Tooltip>
    </div>
  );
}
