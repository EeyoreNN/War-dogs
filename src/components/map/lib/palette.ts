// Map colours as literal hex (§4.3.2 export contract): every map element carries presentation
// attributes, so the tokens from globals.css are mirrored here once and written as attributes.
// `palette.test.ts` asserts these match the `:root` values in globals.css so they cannot drift.
import { enemyTone } from "@/lib/map/teams";
import { INK_HEX, MARKER_META, type InkColor, type Marker, type Team } from "@/lib/map/types";

export const TOKEN_HEX = {
  bg0: "#141311",
  bg1: "#1e1c18",
  bg2: "#2b2823",
  text0: "#f1ebdd",
  text1: "#a89f8f",
  accent: "#ffa028",
  accentInk: "#141311",
  friendly: "#5fb8ff",
  enemyA: "#ff6a2b",
  enemyB: "#ff66c4",
  lz: "#7ed4c1",
  rally: "#e8d26a",
  objective: "#ffffff",
  danger: "#ff2e2e",
  warn: "#e8d26a",
  reqOpen: "#f1ebdd",
  reqClaimed: "#ffa028",
  reqDelivered: "#7e8a6c",
  ok: "#46c46e",
} as const;

/** Marker glyph colour: friendly kinds by their token, enemy kinds by the faction tone (§2.3). */
export function markerHex(marker: Pick<Marker, "kind" | "team">, roomTeam: Team): string {
  switch (marker.kind) {
    case "fob":
      return TOKEN_HEX.friendly;
    case "rally":
      return TOKEN_HEX.rally;
    case "lz":
      return TOKEN_HEX.lz;
    case "obj":
      return TOKEN_HEX.objective;
    case "enemy-fob":
    case "enemy-troops": {
      const tone = marker.team ? enemyTone(roomTeam, marker.team) : "enemy-a";
      return tone === "enemy-a" ? TOKEN_HEX.enemyA : TOKEN_HEX.enemyB;
    }
    case "danger":
      return TOKEN_HEX.danger;
    case "pin":
      return TOKEN_HEX.warn;
  }
}

/** Palette tile colour in the rail (the enemy tiles follow the selected faction). */
export function paletteHex(kind: Marker["kind"], roomTeam: Team, enemyTeam: Team): string {
  return markerHex(
    { kind, team: MARKER_META[kind].group === "enemy" ? enemyTeam : null },
    roomTeam,
  );
}

export const requestHex = (status: "open" | "claimed" | "delivered"): string =>
  status === "open"
    ? TOKEN_HEX.reqOpen
    : status === "claimed"
      ? TOKEN_HEX.reqClaimed
      : TOKEN_HEX.reqDelivered;

export const inkHex = (c: InkColor): string => INK_HEX[c];

/** Text label sizes in world px (the map is MAP_PX wide). */
export const TEXT_SIZE_PX = { sm: 28, md: 40, lg: 56 } as const;
/** Shape / measure stroke width in world px. */
export const SHAPE_STROKE_PX = 6;
export const MEASURE_STROKE_PX = 4;
/** Marker symbol size on screen (px at every zoom). */
export const MARKER_PX = 32;
