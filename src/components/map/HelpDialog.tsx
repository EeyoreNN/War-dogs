"use client";

// Controls & help (§4.3.2, Appendix A): the keyboard and gesture map rendered from KEYMAP, the
// platform modifier from useModifierKey, and the Pings preference.
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useRoomStore } from "@/store/room";
import { KEYMAP } from "./lib/keymap";
import { useUiStore } from "./ui-store";

export function HelpDialog() {
  const open = useUiStore((s) => s.helpOpen);
  const uiSet = useUiStore((s) => s.set);
  const showPings = useRoomStore((s) => s.showPings);
  const setShowPings = useRoomStore((s) => s.setShowPings);
  return (
    <Dialog
      open={open}
      onClose={() => uiSet({ helpOpen: false })}
      title="Controls & help"
      size="lg"
      description="Every pointer action has a keyboard path. Shortcuts pause while you type."
      footer={
        <Button variant="secondary" onClick={() => uiSet({ helpOpen: false })}>
          Close
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="label-mono">
              <th scope="col" className="pr-4 pb-2 font-normal">
                Key
              </th>
              <th scope="col" className="pr-4 pb-2 font-normal">
                Action
              </th>
              <th scope="col" className="pb-2 font-normal">
                Context
              </th>
            </tr>
          </thead>
          <tbody>
            {KEYMAP.map((row) => (
              <tr key={row.action} className="border-t border-line align-top">
                <td className="py-2 pr-4">
                  <span className="flex flex-wrap gap-1">
                    {row.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </td>
                <td className="py-2 pr-4 text-fg">{row.action}</td>
                <td className="py-2 text-fg-muted">{row.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="mt-5 flex items-center gap-3 border-t border-line pt-4 text-[15px] text-fg">
        <input
          type="checkbox"
          checked={showPings}
          onChange={(e) => setShowPings(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          Pings <span className="text-fg-muted">— show other people&apos;s pings on the map</span>
        </span>
      </label>
    </Dialog>
  );
}
