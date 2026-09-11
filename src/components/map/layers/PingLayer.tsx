// Pings (§4.3.3, motion "ping"): a ring in the sender's ink colour with the callsign, 4 s,
// three pulses; commander pings are accent and 1.5×. Never exported.
import type { Ping } from "@/lib/map/types";
import { inkHex, TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";

const LABEL_FONT = "JetBrains Mono, ui-monospace, Menlo, monospace";

export function PingLayer({ pings, reducedMotion }: { pings: Ping[]; reducedMotion?: boolean }) {
  if (pings.length === 0) return null;
  return (
    <g data-layer-group="pings" data-export="skip" pointerEvents="none">
      {pings.map((p) => {
        const hex = p.commander ? TOKEN_HEX.accent : inkHex(p.color);
        const k = p.commander ? 1.5 : 1;
        return (
          <g key={p.id} data-ping="" data-screen="" style={{ transform: screenTransform(p.at) }}>
            {reducedMotion ? (
              <circle cx={0} cy={0} r={18 * k} fill="none" stroke={hex} strokeWidth={2.5} />
            ) : (
              [0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx={0}
                  cy={0}
                  r={18 * k}
                  fill="none"
                  stroke={hex}
                  strokeWidth={2.5}
                  style={{
                    transformOrigin: "0 0",
                    animation: `wd-ping 1.2s cubic-bezier(0.2,0.7,0.2,1) ${i * 1.2}s 1 both`,
                  }}
                />
              ))
            )}
            <circle cx={0} cy={0} r={4 * k} fill={hex} />
            <text
              x={0}
              y={-24 * k}
              textAnchor="middle"
              fontFamily={LABEL_FONT}
              fontSize={11}
              fontWeight={700}
              letterSpacing="0.06em"
              fill={hex}
              stroke={TOKEN_HEX.bg0}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {p.byName.toUpperCase()}
            </text>
          </g>
        );
      })}
    </g>
  );
}
