// Peers' cursors as small chevrons in their ink colour with the callsign (§4.3.2). Hidden in
// Brief mode, never exported.
import type { Presence, RosterMember } from "@/lib/map/types";
import { inkHex, TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";
import { CURSOR_SYMBOL_ID } from "../MarkerSprite";

const LABEL_FONT = "JetBrains Mono, ui-monospace, Menlo, monospace";

export function CursorLayer({
  presence,
  roster,
  self,
}: {
  presence: Record<string, Presence>;
  roster: Record<string, RosterMember>;
  self: string | null;
}) {
  const peers = Object.values(presence).filter((p) => p.cursor && p.client !== self);
  if (peers.length === 0) return null;
  return (
    <g data-layer-group="cursors" data-export="skip" pointerEvents="none">
      {peers.map((p) => {
        const member = roster[p.client];
        const hex = member ? inkHex(member.ink) : TOKEN_HEX.text1;
        const name = (member?.callsign || p.callsign || "").toUpperCase();
        return (
          <g
            key={p.client}
            data-screen=""
            style={{ transform: screenTransform(p.cursor!), transition: "transform 60ms linear" }}
          >
            <use href={`#${CURSOR_SYMBOL_ID}`} x={-4} y={-4} width={20} height={20} color={hex} />
            <text
              x={16}
              y={22}
              fontFamily={LABEL_FONT}
              fontSize={10}
              fontWeight={700}
              fill={hex}
              stroke={TOKEN_HEX.bg0}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
