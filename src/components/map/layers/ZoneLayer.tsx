// The control zone: a dashed accent ring and polygon fill (world-scaled) plus a name chip
// (screen-constant), matching the terrain SVG's own zone treatment (§3.7).
import type { ControlZone } from "@/lib/terrain/types";
import { MAP_PX } from "@/lib/map/types";
import { TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";

const f = (n: number) => n.toFixed(1);

export function ZoneLayer({ zone }: { zone: ControlZone | null }) {
  if (!zone) return null;
  const cx = zone.center.x * MAP_PX;
  const cy = zone.center.y * MAP_PX;
  const r = zone.radius * MAP_PX;
  const poly = zone.polygon.map((p) => `${f(p.x * MAP_PX)},${f(p.y * MAP_PX)}`).join(" ");
  const label = zone.name.toUpperCase();
  const chipW = label.length * 7 + 16;
  return (
    <g data-layer-group="zone" pointerEvents="none">
      <polygon points={poly} fill={TOKEN_HEX.accent} fillOpacity={0.1} />
      <circle
        cx={f(cx)}
        cy={f(cy)}
        r={f(r)}
        fill="none"
        stroke={TOKEN_HEX.accent}
        strokeWidth={4}
        strokeDasharray="12 8"
      />
      <g
        data-screen=""
        style={{ transform: screenTransform({ x: zone.center.x, y: zone.center.y - zone.radius }) }}
      >
        <rect x={-chipW / 2} y={-26} width={chipW} height={18} rx={3} fill={TOKEN_HEX.accent} />
        <text
          x={0}
          y={-13}
          textAnchor="middle"
          fontFamily="JetBrains Mono, ui-monospace, Menlo, monospace"
          fontSize={10}
          fontWeight={700}
          letterSpacing="0.12em"
          fill={TOKEN_HEX.accentInk}
        >
          {label}
        </text>
      </g>
    </g>
  );
}
