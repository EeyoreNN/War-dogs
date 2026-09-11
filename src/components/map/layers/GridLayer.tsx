// 10 × 10 grid with A–J on the top edge and 1–10 on the left (§4.3.3). Lines are world-scaled,
// labels screen-constant so they never drop below 10 px; at scale ≥ 2 each cell shows a faint 3 × 3 sub-grid.
import { GRID_COLS, GRID_N, gridLines } from "@/lib/map/grid";
import { MAP_PX } from "@/lib/map/types";
import { TOKEN_HEX } from "../lib/palette";
import { screenTransform } from "../lib/screen";

const LINE = "rgba(241,235,221,0.16)";
const SUB = "rgba(241,235,221,0.07)";
const LABEL_FONT = "JetBrains Mono, ui-monospace, Menlo, monospace";

export function GridLayer({ subgrid }: { subgrid?: boolean }) {
  const { cols, rows } = gridLines();
  const cell = MAP_PX / GRID_N;
  const subs: number[] = [];
  if (subgrid) for (let i = 0; i < GRID_N * 3; i++) if (i % 3 !== 0) subs.push((i * cell) / 3);
  return (
    <g data-layer-group="grid" pointerEvents="none">
      {subs.map((v) => (
        <g key={`s${v}`}>
          <line
            x1={v}
            y1={0}
            x2={v}
            y2={MAP_PX}
            stroke={SUB}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            y1={v}
            x2={MAP_PX}
            y2={v}
            stroke={SUB}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {cols.map((c) => (
        <line
          key={`c${c}`}
          x1={c * MAP_PX}
          y1={0}
          x2={c * MAP_PX}
          y2={MAP_PX}
          stroke={LINE}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {rows.map((r) => (
        <line
          key={`r${r}`}
          x1={0}
          y1={r * MAP_PX}
          x2={MAP_PX}
          y2={r * MAP_PX}
          stroke={LINE}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {Array.from({ length: GRID_N }, (_, i) => (
        <g key={`gl${i}`}>
          <g data-screen="" style={{ transform: screenTransform({ x: (i + 0.5) / GRID_N, y: 0 }) }}>
            <text
              x={0}
              y={13}
              textAnchor="middle"
              fontFamily={LABEL_FONT}
              fontSize={10}
              fontWeight={700}
              fill={TOKEN_HEX.text0}
              fillOpacity={0.7}
              stroke={TOKEN_HEX.bg0}
              strokeWidth={2.5}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {GRID_COLS[i]}
            </text>
          </g>
          <g data-screen="" style={{ transform: screenTransform({ x: 0, y: (i + 0.5) / GRID_N }) }}>
            <text
              x={4}
              y={4}
              textAnchor="start"
              fontFamily={LABEL_FONT}
              fontSize={10}
              fontWeight={700}
              fill={TOKEN_HEX.text0}
              fillOpacity={0.7}
              stroke={TOKEN_HEX.bg0}
              strokeWidth={2.5}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {i + 1}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}
