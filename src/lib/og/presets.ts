import type { MapId } from "@/lib/terrain/types";

/** One OG composition (§6.2): a headline of up to three lines, a strapline, an optional map crop. */
export interface OgPreset {
  /** Up to three uppercase lines. */
  headline: string[];
  strapline: string;
  /** Map whose terrain crop sits at 40 % behind the right half, or null for none. */
  terrain: MapId | null;
  /** `og:image:alt` text for the route's `alt` export. */
  alt: string;
}

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const ROOT_STRAP = "DRAW THE PLAN. CALL THE DROP. EVERYONE SEES IT.";

/** The presets every route file uses (§6.2). The room preset never carries the room code. */
export const OG_PRESETS = {
  root: {
    headline: ["THE TACTICAL MAP", "EVERY WARDOGS", "SERVER NEEDS"],
    strapline: ROOT_STRAP,
    terrain: null,
    alt: "wardogs.tech — the tactical map every Wardogs server needs. Draw the plan. Call the drop. Everyone sees it.",
  },
  demo: {
    headline: ["THE LIVE DEMO"],
    strapline: "A SHARED MAP. NO SIGN-IN. RESETS EVERY FIVE MINUTES.",
    terrain: "zestafona",
    alt: "The live demo — a shared map, no sign-in, resets every five minutes.",
  },
  dev: {
    headline: ["RUN YOUR SERVER"],
    strapline: "RCON · OPENAPI · CONFIG · DISCORD HELP",
    terrain: null,
    alt: "Run your server — RCON, OpenAPI, config and Discord help for Wardogs dedicated servers.",
  },
  admin: {
    headline: ["SERVER ADMIN", "IN THE SAME DISCORD"],
    strapline: "LIVE PLAYERS. MATCH HISTORY. BANS WITH EVIDENCE.",
    terrain: "bakurani",
    alt: "Server admin in the same Discord — live players, match history, bans with evidence.",
  },
  room: {
    headline: ["JOIN THE WAR ROOM"],
    strapline: "OPEN THE LINK. TYPE A CALLSIGN. YOU ARE ON THE MAP.",
    terrain: "ozeti",
    alt: "Join the war room — open the link, type a callsign, you are on the map.",
  },
  create: {
    headline: ["OPEN A WAR ROOM"],
    strapline: ROOT_STRAP,
    terrain: null,
    alt: "Open a war room on wardogs.tech.",
  },
  join: {
    headline: ["JOIN A WAR ROOM"],
    strapline: ROOT_STRAP,
    terrain: null,
    alt: "Join a war room on wardogs.tech.",
  },
} as const satisfies Record<string, OgPreset>;

export type OgPresetId = keyof typeof OG_PRESETS;
