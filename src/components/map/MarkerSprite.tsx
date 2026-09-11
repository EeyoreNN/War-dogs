// Marker glyphs (Appendix B): original artwork, 32-unit <symbol>s with a 2-unit stroke, a filled
// backing shape for legibility on any terrain, presentation attributes only (§4.3.2). The symbols
// live in <defs> inside the map <svg> so `<use href="#m-…">` survives serialisation.
import type * as React from "react";
import { MARKER_KINDS, type MarkerKind } from "@/lib/map/types";
import { TOKEN_HEX } from "./lib/palette";

export const symbolId = (kind: MarkerKind): string => `m-${kind}`;
export const REQUEST_SYMBOL_ID = "m-request";
export const CURSOR_SYMBOL_ID = "m-cursor";

const BACKING = { fill: TOKEN_HEX.bg0, fillOpacity: 0.78 } as const;

function Backing({ r = 13 }: { r?: number }) {
  return <circle cx="16" cy="16" r={r} fill={BACKING.fill} fillOpacity={BACKING.fillOpacity} />;
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/** The glyph bodies, keyed by kind; each draws inside a 32 × 32 box centred at (16, 16). */
const GLYPH: Record<MarkerKind, React.ReactNode> = {
  fob: (
    <>
      <Backing />
      <path d="M7 22 L16 8 L25 22 Z" {...stroke} />
      <path d="M13 22 L16 16 L19 22" {...stroke} />
      <path d="M5 24 H27" {...stroke} />
    </>
  ),
  rally: (
    <>
      <Backing />
      <path d="M11 26 V6" {...stroke} />
      <path
        d="M11 7 H23 L20 11.5 L23 16 H11 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </>
  ),
  lz: (
    <>
      <Backing r={14} />
      <circle cx="16" cy="16" r="10.5" {...stroke} />
      <path d="M11.5 10 V22 M20.5 10 V22 M11.5 16 H20.5" {...stroke} />
    </>
  ),
  obj: (
    <>
      <Backing r={14} />
      <circle cx="16" cy="16" r="11" {...stroke} />
      <circle cx="16" cy="16" r="6" {...stroke} />
      <circle cx="16" cy="16" r="1.8" fill="currentColor" />
    </>
  ),
  "enemy-fob": (
    <>
      <Backing />
      <path d="M7 10 L16 24 L25 10 Z" {...stroke} />
      <path d="M13 10 L16 16 L19 10" {...stroke} />
      <path d="M5 8 H27" {...stroke} />
    </>
  ),
  "enemy-troops": (
    <>
      <Backing r={14} />
      <path d="M16 4 L28 16 L16 28 L4 16 Z" {...stroke} />
      <path d="M11 12.5 L16 17.5 L21 12.5" {...stroke} />
      <path d="M11 17.5 L16 22.5 L21 17.5" {...stroke} />
    </>
  ),
  danger: (
    <>
      <Backing r={14} />
      <path d="M16 5 L28 26 H4 Z" {...stroke} />
      <path d="M16 12 V18" {...stroke} />
      <circle cx="16" cy="22" r="1.4" fill="currentColor" />
    </>
  ),
  pin: (
    <>
      <circle cx="16" cy="13" r="11" fill={BACKING.fill} fillOpacity={BACKING.fillOpacity} />
      <path d="M16 29 C16 29 7 19 7 12.5 A9 9 0 0 1 25 12.5 C25 19 16 29 16 29 Z" {...stroke} />
      <circle cx="16" cy="12.5" r="3" fill="currentColor" />
    </>
  ),
};

/**
 * `<defs>` with every marker symbol, the request crate and the peer cursor chevron. Rendered
 * once per map SVG (preview and live) so exports carry their own glyphs.
 */
export function MarkerDefs() {
  return (
    <defs>
      {MARKER_KINDS.map((kind) => (
        <symbol key={kind} id={symbolId(kind)} viewBox="0 0 32 32">
          {GLYPH[kind]}
        </symbol>
      ))}
      <symbol id={REQUEST_SYMBOL_ID} viewBox="0 0 32 32">
        <rect
          x="4"
          y="9"
          width="24"
          height="19"
          rx="2"
          fill={BACKING.fill}
          fillOpacity={BACKING.fillOpacity}
        />
        <rect x="5.5" y="10.5" width="21" height="16" rx="1.5" {...stroke} />
        <path d="M5.5 15 H26.5 M16 10.5 V26.5 M9 22 L23 22" {...stroke} strokeWidth={1.5} />
        <path d="M12 6 H20 V10.5 H12 Z" fill="currentColor" />
      </symbol>
      <symbol id={CURSOR_SYMBOL_ID} viewBox="0 0 32 32">
        <path
          d="M6 4 L26 14 L16 17 L13 27 Z"
          fill="currentColor"
          stroke={TOKEN_HEX.bg0}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </symbol>
    </defs>
  );
}

/** Inline glyph for the rail palette and lists (not inside the map SVG; carries its own symbol body). */
export function MarkerGlyph({
  kind,
  color,
  size = 20,
  className,
}: {
  kind: MarkerKind;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      style={{ color }}
    >
      {GLYPH[kind]}
    </svg>
  );
}
