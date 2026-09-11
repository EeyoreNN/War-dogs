"use client";

// "How focus and map access work" (§4.4), shared by /create, /join and the Roster header.
import { Dialog } from "@/components/ui/dialog";

export function FocusHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="How focus and map access work" size="md">
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-fg-muted">
        <p>
          <strong className="text-fg">Focus</strong> is what you are doing this match: Infantry,
          Medic, Recon, Support, Driver or Pilot. It shows next to your name so a commander can see
          gaps, and requests that match your focus float to the top of your list.
        </p>
        <p>
          <strong className="text-fg">Map access</strong> is set by the commander. With{" "}
          <em>Everyone</em>, anyone in the room draws. With <em>By request</em>, only the commander
          and co-commanders draw until they approve you; ask from any greyed tool and they will see
          it in the Roster.
        </p>
      </div>
    </Dialog>
  );
}
