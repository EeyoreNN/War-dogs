import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShellStatic, ShellMapArea } from "@/components/map/AppShell";
import MapAppLoader from "@/components/map/MapAppLoader";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_ROOM_CODE } from "@/lib/map/types";
import { AnyRoomCodeSchema } from "@/lib/room/schema";

export const metadata: Metadata = {
  title: "War room",
  description: "A shared tactical map. Open it in your Discord voice channel.",
  robots: { index: false, follow: false },
};

// `params` is a Promise in Next 16 (§3.14). The plan lives client-side, so the shell shows a
// skeleton map; MapApp reads `?t=` / `?s=` from window.location after mount, never from here.
export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const { code: raw } = await params;
  const parsed = AnyRoomCodeSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const code = parsed.data;
  if (code === DEMO_ROOM_CODE) redirect("/demo");
  return (
    <MapAppLoader mode="room" code={code}>
      <AppShellStatic code={code}>
        <ShellMapArea>
          <Skeleton className="h-full w-full rounded-none opacity-60" />
        </ShellMapArea>
      </AppShellStatic>
    </MapAppLoader>
  );
}
