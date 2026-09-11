import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { markerHex, paletteHex, requestHex, TOKEN_HEX } from "./palette";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --${name} missing from globals.css`);
  return m[1].toLowerCase();
};

describe("map palette mirrors globals.css", () => {
  it.each([
    ["bg-0", TOKEN_HEX.bg0],
    ["bg-1", TOKEN_HEX.bg1],
    ["bg-2", TOKEN_HEX.bg2],
    ["text-0", TOKEN_HEX.text0],
    ["text-1", TOKEN_HEX.text1],
    ["accent", TOKEN_HEX.accent],
    ["friendly", TOKEN_HEX.friendly],
    ["enemy-a", TOKEN_HEX.enemyA],
    ["enemy-b", TOKEN_HEX.enemyB],
    ["lz", TOKEN_HEX.lz],
    ["rally", TOKEN_HEX.rally],
    ["objective", TOKEN_HEX.objective],
    ["danger", TOKEN_HEX.danger],
    ["warn", TOKEN_HEX.warn],
    ["req-open", TOKEN_HEX.reqOpen],
    ["req-claimed", TOKEN_HEX.reqClaimed],
    ["req-delivered", TOKEN_HEX.reqDelivered],
    ["ok", TOKEN_HEX.ok],
  ])("--%s", (name, hex) => {
    expect(token(name)).toBe(hex);
  });

  it("never draws a marker in a team colour", () => {
    const teamHexes = ["#5fb8ff", "#ff4d4d", "#46c46e"];
    // Friendly markers are `friendly` blue (which shares the hex with Lonestar by design, §2.3),
    // so only the enemy and mark groups are checked against the team palette.
    expect(teamHexes).not.toContain(markerHex({ kind: "enemy-fob", team: "Valkyra" }, "Lonestar"));
    expect(teamHexes).not.toContain(
      markerHex({ kind: "enemy-troops", team: "Manticore" }, "Lonestar"),
    );
    expect(teamHexes).not.toContain(markerHex({ kind: "danger", team: null }, "Valkyra"));
  });

  it("enemy tone follows site.game.teams order with the room team removed", () => {
    expect(markerHex({ kind: "enemy-fob", team: "Valkyra" }, "Lonestar")).toBe(TOKEN_HEX.enemyA);
    expect(markerHex({ kind: "enemy-fob", team: "Manticore" }, "Lonestar")).toBe(TOKEN_HEX.enemyB);
    expect(markerHex({ kind: "enemy-troops", team: "Lonestar" }, "Valkyra")).toBe(TOKEN_HEX.enemyA);
    expect(paletteHex("enemy-troops", "Valkyra", "Manticore")).toBe(TOKEN_HEX.enemyB);
    expect(paletteHex("fob", "Valkyra", "Manticore")).toBe(TOKEN_HEX.friendly);
  });

  it("request pins are coloured by state", () => {
    expect(requestHex("open")).toBe(TOKEN_HEX.reqOpen);
    expect(requestHex("claimed")).toBe(TOKEN_HEX.reqClaimed);
    expect(requestHex("delivered")).toBe(TOKEN_HEX.reqDelivered);
  });
});
