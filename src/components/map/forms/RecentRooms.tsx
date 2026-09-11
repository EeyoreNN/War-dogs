"use client";

// The Rejoin list on /join (§4.5): the home page's card with the map's display name, so the
// two pages share one row format and one relative-time formatter.
import { RecentRooms as RejoinCard } from "@/components/home/RecentRooms";
import { mapById } from "@/config/maps";

const mapName = (id: string) => mapById(id)?.name ?? id;

export function RecentRooms() {
  return <RejoinCard className="mt-6 w-full max-w-[640px]" mapName={mapName} />;
}
