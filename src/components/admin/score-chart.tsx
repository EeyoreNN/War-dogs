import { site } from "@/config/site";
import type { MatchRecord } from "@/lib/admin-sim/types";
import { TEAM_STROKE } from "./format";

const W = 120;
const H = 40;

/**
 * Inline SVG line chart of a match's score timeline (§4.8): three team lines in the team
 * colours, 120×40 units scaled by CSS, labelled with the final scores for screen readers.
 */
export function ScoreChart({
  record,
  cap = 100,
  className,
}: {
  record: MatchRecord;
  cap?: number;
  className?: string;
}) {
  const { timeline, final } = record;
  const t0 = timeline[0]?.t ?? record.startedAt;
  const t1 = timeline[timeline.length - 1]?.t ?? record.endedAt;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (v: number) => H - 1 - (Math.min(cap, v) / cap) * (H - 2);
  const label = site.game.teams.map((team) => `${team} ${final[team]}`).join(", ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Score over the match: ${label}`}
      className={className}
      preserveAspectRatio="none"
    >
      <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="var(--border-strong)" strokeWidth="0.5" />
      <line
        x1="0"
        y1={y(cap / 2)}
        x2={W}
        y2={y(cap / 2)}
        stroke="var(--border)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      {site.game.teams.map((team) => (
        <polyline
          key={team}
          fill="none"
          stroke={TEAM_STROKE[team]}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          points={timeline
            .map((p) => `${x(p.t).toFixed(2)},${y(p.scores[team]).toFixed(2)}`)
            .join(" ")}
        />
      ))}
    </svg>
  );
}
