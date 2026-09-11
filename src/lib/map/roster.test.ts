import { describe, expect, it } from "vitest";
import {
  canDraw,
  editableLayer,
  focusTally,
  focusWarnings,
  isCommand,
  isIdle,
  isOnline,
  singleWriter,
  staleMembers,
  successor,
  visibleLayers,
} from "./roster";
import { enemyTeams, enemyTone } from "./teams";
import { A, B, C, baseSettings, member } from "./test-fixtures";
import { IDLE_AFTER_MS, ONLINE_TTL_MS, PEER_TTL_MS, asClientId, type Presence } from "./types";

const pres = (client: string, seenAt: number): Presence => ({
  client: asClientId(client),
  callsign: "x",
  seenAt,
  cursor: null,
});
const NOW = 1_000_000;

describe("roster", () => {
  it("isOnline: fresh presence → true, stale → false, no record → the flag", () => {
    const m = member(A, { online: false });
    expect(isOnline(m, pres(A, NOW - 1000), NOW)).toBe(true);
    expect(isOnline(m, pres(A, NOW - ONLINE_TTL_MS), NOW)).toBe(false);
    expect(isOnline(m, undefined, NOW)).toBe(false);
    expect(isOnline({ ...m, online: true }, undefined, NOW)).toBe(true);
    expect(isOnline({ ...m, online: true }, pres(A, NOW - ONLINE_TTL_MS - 1), NOW)).toBe(false);
  });
  it("canDraw matrix", () => {
    const everyone = baseSettings({ drawAccess: "everyone" });
    const request = baseSettings({ drawAccess: "request" });
    for (const role of ["member", "co-commander", "commander"] as const) {
      for (const flag of [true, false]) {
        const m = member(A, { role, canDraw: flag });
        expect(canDraw(m, everyone)).toBe(true);
        expect(canDraw(m, request)).toBe(role !== "member" || flag);
      }
    }
    expect(canDraw(null, everyone)).toBe(true);
    expect(canDraw(null, request)).toBe(false);
    expect(isCommand(member(A, { role: "co-commander" }))).toBe(true);
    expect(isCommand(member(A))).toBe(false);
    expect(isCommand(null)).toBe(false);
  });
  it("tallies count online members only, warnings name pilot and medic", () => {
    const roster = [
      member(A, { focus: "medic" }),
      member(B, { focus: "medic" }),
      member(C, { focus: "pilot", online: false }),
      member(asClientId("wd_DDDDDDDDDDDD"), { focus: null }),
    ];
    const presence = { [A]: pres(A, NOW), [B]: pres(B, NOW - ONLINE_TTL_MS - 1) };
    const t = focusTally(roster, presence, NOW);
    expect(t).toEqual({ infantry: 0, medic: 1, recon: 0, support: 0, driver: 0, pilot: 0 });
    expect(focusWarnings(t)).toEqual(["No pilot in room"]);
    expect(focusWarnings({ ...t, medic: 0 })).toEqual(["No pilot in room", "No medic in room"]);
    expect(focusWarnings({ ...t, pilot: 1 })).toEqual([]);
  });
  it("visibleLayers / editableLayer", () => {
    const off = baseSettings();
    const on = baseSettings({ squadMode: true, squads: ["Alpha", "Bravo"] });
    const cmd = member(A, { role: "commander" });
    const bravo = member(B, { squad: "Bravo" });
    const unassigned = member(C);
    expect(visibleLayers(off, bravo)).toEqual(["team"]);
    expect(visibleLayers(on, cmd)).toEqual(["team", "squad:Alpha", "squad:Bravo"]);
    expect(visibleLayers(on, bravo)).toEqual(["team", "squad:Bravo"]);
    expect(visibleLayers(on, unassigned)).toEqual(["team", "squad:Alpha"]);
    expect(editableLayer(off, bravo)).toBe("team");
    expect(editableLayer(on, cmd)).toBe("team");
    expect(editableLayer(on, bravo)).toBe("squad:Bravo");
    expect(editableLayer(on, unassigned)).toBe("squad:Alpha");
    expect(editableLayer(on, null)).toBe("squad:Alpha");
    expect(editableLayer(baseSettings({ squadMode: true, squads: [] }), null)).toBe("team");
  });
  it("isIdle", () => {
    expect(isIdle(undefined, NOW)).toBe(true);
    expect(isIdle(NOW - IDLE_AFTER_MS + 1, NOW)).toBe(false);
    expect(isIdle(NOW - IDLE_AFTER_MS, NOW)).toBe(true);
  });
  it("successor: earliest-joined online co-commander, else earliest-joined online member, never `leaving`", () => {
    const D = asClientId("wd_DDDDDDDDDDDD");
    // Flags off: only presence makes a member online here.
    const roster = [
      member(A, { role: "commander", joinedAt: 1, online: false }),
      member(B, { role: "co-commander", joinedAt: 5, online: false }),
      member(C, { role: "co-commander", joinedAt: 3, online: false }),
      member(D, { role: "member", joinedAt: 2, online: false }),
    ];
    const presence = { [A]: pres(A, NOW), [B]: pres(B, NOW), [D]: pres(D, NOW) };
    expect(successor(roster, presence, NOW, A)?.id).toBe(B);
    expect(successor(roster, { ...presence, [C]: pres(C, NOW) }, NOW, A)?.id).toBe(C);
    expect(
      successor(
        roster,
        { [A]: pres(A, NOW), [B]: pres(B, NOW - ONLINE_TTL_MS - 1), [D]: pres(D, NOW) },
        NOW,
        A,
      )?.id,
    ).toBe(D);
    expect(successor(roster, { [A]: pres(A, NOW) }, NOW, A)).toBeNull();
    expect(successor(roster, presence, NOW, B)?.id).toBe(D);
    // With no presence record at all the persisted flag decides.
    expect(successor([member(B, { role: "co-commander", online: true })], {}, NOW, A)?.id).toBe(B);
  });
  it("singleWriter picks the lowest id with presence within PEER_TTL_MS", () => {
    const roster = [member(C), member(A), member(B)];
    expect(
      singleWriter(
        roster,
        { [B]: pres(B, NOW), [C]: pres(C, NOW), [A]: pres(A, NOW - PEER_TTL_MS) },
        NOW,
      ),
    ).toBe(B);
    expect(singleWriter(roster, { [A]: pres(A, NOW - 1) }, NOW)).toBe(A);
    expect(singleWriter(roster, {}, NOW)).toBeNull();
  });
  it("staleMembers: flag true, no presence for 60 s", () => {
    const roster = [
      member(A, { online: true }),
      member(B, { online: true }),
      member(C, { online: false }),
    ];
    const stale = staleMembers(
      roster,
      { [A]: pres(A, NOW), [B]: pres(B, NOW - ONLINE_TTL_MS - 1) },
      NOW,
    );
    expect(stale.map((m) => m.id)).toEqual([B]);
    expect(staleMembers(roster, {}, NOW)).toEqual([]);
  });
});

describe("teams", () => {
  it("enemyTeams and enemyTone for all three teams", () => {
    expect(enemyTeams("Lonestar")).toEqual(["Valkyra", "Manticore"]);
    expect(enemyTeams("Valkyra")).toEqual(["Lonestar", "Manticore"]);
    expect(enemyTeams("Manticore")).toEqual(["Lonestar", "Valkyra"]);
    expect(enemyTone("Lonestar", "Valkyra")).toBe("enemy-a");
    expect(enemyTone("Lonestar", "Manticore")).toBe("enemy-b");
    expect(enemyTone("Valkyra", "Lonestar")).toBe("enemy-a");
    expect(enemyTone("Manticore", "Valkyra")).toBe("enemy-b");
  });
});
