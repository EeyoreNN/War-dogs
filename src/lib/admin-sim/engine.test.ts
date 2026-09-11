import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  HISTORY_MS,
  MATCH_MS,
  SIM_EPOCH,
  boundaryDate,
  botName,
  effectiveCommands,
  resetBoundary,
  stateAt,
  toRcon,
} from "./engine";
import type { AdminCommand, TimedCommand } from "./types";

const NOW = Date.UTC(2026, 8, 11, 13, 4, 31); // 2026-09-11T13:04:31Z
const ME = "Operator 41E3";

let seq = 0;
const cmd = (at: number, c: AdminCommand, actor = ME): TimedCommand => ({
  id: `c${++seq}`,
  at,
  actor,
  cmd: c,
});

const base = () => stateAt(DEFAULT_SEED, NOW, [], ME);

describe("stateAt", () => {
  it("is deterministic: same inputs give a deep-equal state", () => {
    const a = stateAt(DEFAULT_SEED, NOW, [], ME);
    const b = stateAt(DEFAULT_SEED, NOW, [], ME);
    expect(a).toEqual(b);
    expect(stateAt(DEFAULT_SEED + 1, NOW, [], ME)).not.toEqual(a);
  });

  it("keeps the roster between 13 and 40 bots with invented names and steam ids", () => {
    for (let k = 0; k < 20; k++) {
      const s = stateAt(DEFAULT_SEED, NOW + k * 7 * 60_000, [], ME);
      expect(s.players.length).toBeGreaterThanOrEqual(13);
      expect(s.players.length).toBeLessThanOrEqual(40);
      for (const p of s.players) {
        expect(p.steamId).toMatch(/^7656119\d{10}$/);
        expect(p.name).toMatch(/^[A-Z][a-z]+\d{0,2}$/);
        expect(p.pingMs).toBeGreaterThan(0);
        expect(p.joinedAt).toBeLessThanOrEqual(NOW + k * 7 * 60_000);
      }
      expect(new Set(s.players.map((p) => p.steamId)).size).toBe(s.players.length);
    }
  });

  it("scores are monotone within a match and the winner reaches 100 at the end", () => {
    const s0 = base();
    const { startedAt, endsAt } = s0.match;
    let prev = stateAt(DEFAULT_SEED, startedAt, [], ME).scores;
    for (let t = startedAt + 30_000; t < endsAt; t += 90_000) {
      const cur = stateAt(DEFAULT_SEED, t, [], ME).scores;
      for (const team of ["Lonestar", "Valkyra", "Manticore"] as const)
        expect(cur[team]).toBeGreaterThanOrEqual(prev[team]);
      prev = cur;
    }
    const end = stateAt(DEFAULT_SEED, endsAt - 1, [], ME);
    expect(Math.max(...Object.values(end.scores))).toBeGreaterThanOrEqual(99);
    expect(Object.values(end.scores).every((v) => v <= 100)).toBe(true);
  });

  it("match n increases monotonically and the map rotates Zestafona → Bakurani → Ozeti", () => {
    const n0 = Math.floor((NOW - SIM_EPOCH) / MATCH_MS);
    const s = base();
    expect(s.match.n).toBe(n0);
    expect(s.match.startedAt).toBe(SIM_EPOCH + n0 * MATCH_MS);
    const order = ["zestafona", "bakurani", "ozeti"];
    for (let k = 0; k < 4; k++) {
      const sk = stateAt(DEFAULT_SEED, NOW + k * MATCH_MS, [], ME);
      expect(sk.match.n).toBe(n0 + k);
      expect(sk.map).toBe(order[(n0 + k) % 3]);
      expect(sk.rotation[sk.rotationIndex].status).toBe("now");
    }
  });

  it("history covers 72 h at 40 min per match, most recent first, with timelines and boards", () => {
    const s = base();
    const expected = Math.floor(HISTORY_MS / MATCH_MS);
    expect(Math.abs(s.history.length - expected)).toBeLessThanOrEqual(1);
    for (let i = 1; i < s.history.length; i++)
      expect(s.history[i - 1].endedAt).toBeGreaterThan(s.history[i].endedAt);
    const r = s.history[0];
    expect(r.endedAt - r.startedAt).toBe(MATCH_MS);
    expect(r.final[r.winner]).toBe(100);
    expect(r.timeline[0].t).toBe(r.startedAt);
    expect(r.timeline[r.timeline.length - 1].t).toBe(r.endedAt);
    expect(r.players.length).toBeGreaterThanOrEqual(13);
    expect(s.sessions.some((x) => x.matchN === r.n)).toBe(true);
    expect(s.audit.some((a) => a.actor === "server" && a.action === "match.end")).toBe(true);
  });
});

describe("commands", () => {
  it("kick removes the player, audits it as mine, and restores them within 90–300 s", () => {
    const victim = base().players[3];
    const cmds = [cmd(NOW - 1000, { t: "kick", steamId: victim.steamId, reason: "team killing" })];
    const after = stateAt(DEFAULT_SEED, NOW, cmds, ME);
    expect(after.players.find((p) => p.steamId === victim.steamId)).toBeUndefined();
    const row = after.audit.find((a) => a.action === "kick");
    expect(row).toMatchObject({
      actor: ME,
      mine: true,
      target: victim.name,
      result: "ok",
      detail: '"team killing"',
    });
    expect(row?.rcon).toEqual({
      method: "POST",
      path: `/v1/players/${victim.steamId}/kick`,
      body: { reason: "team killing" },
    });
    expect(
      stateAt(DEFAULT_SEED, NOW + 89_000, cmds, ME).players.some(
        (p) => p.steamId === victim.steamId,
      ),
    ).toBe(false);
    expect(
      stateAt(DEFAULT_SEED, NOW + 301_000, cmds, ME).players.some(
        (p) => p.steamId === victim.steamId,
      ),
    ).toBe(true);
    // Not mine when someone else did it.
    const theirs = stateAt(
      DEFAULT_SEED,
      NOW,
      [cmd(NOW - 1000, { t: "kick", steamId: victim.steamId, reason: "x" }, "Someone")],
      ME,
    );
    expect(theirs.audit.find((a) => a.action === "kick")?.mine).toBe(false);
  });

  it("refuses to kick someone who is not on the server", () => {
    const s = stateAt(
      DEFAULT_SEED,
      NOW,
      [cmd(NOW - 1, { t: "kick", steamId: "76561190000000000", reason: "x" })],
      ME,
    );
    expect(s.audit[0]).toMatchObject({ result: "refused", target: "76561190000000000" });
  });

  it("ban removes until expiry (default 60 min, capped at 6 h) and unban lifts it", () => {
    const victim = base().players[0];
    const ban = cmd(NOW - 60_000, {
      t: "ban",
      steamId: victim.steamId,
      reason: "cheating",
      evidenceUrl: "https://x.test/clip",
      minutes: 0,
    });
    const during = stateAt(DEFAULT_SEED, NOW, [ban], ME);
    expect(during.bans).toHaveLength(1);
    expect(during.bans[0]).toMatchObject({
      steamId: victim.steamId,
      name: victim.name,
      bannedBy: ME,
      evidenceUrl: "https://x.test/clip",
    });
    expect(during.bans[0].expiresAt).toBe(NOW - 60_000 + 60 * 60_000);
    expect(during.players.some((p) => p.steamId === victim.steamId)).toBe(false);
    const later = stateAt(DEFAULT_SEED, NOW - 60_000 + 61 * 60_000, [ban], ME);
    expect(later.bans).toHaveLength(0);
    const capped = stateAt(
      DEFAULT_SEED,
      NOW,
      [
        cmd(NOW - 1, {
          t: "ban",
          steamId: victim.steamId,
          reason: "r",
          evidenceUrl: null,
          minutes: 9999,
        }),
      ],
      ME,
    );
    expect(capped.bans[0].expiresAt).toBe(NOW - 1 + 360 * 60_000);
    const unbanned = stateAt(
      DEFAULT_SEED,
      NOW,
      [ban, cmd(NOW - 30_000, { t: "unban", steamId: victim.steamId })],
      ME,
    );
    expect(unbanned.bans).toHaveLength(0);
    expect(unbanned.audit.find((a) => a.action === "unban")?.result).toBe("ok");
    expect(
      stateAt(DEFAULT_SEED, NOW, [cmd(NOW - 1, { t: "unban", steamId: victim.steamId })], ME)
        .audit[0].result,
    ).toBe("refused");
  });

  it("move changes the team until the next match", () => {
    const s0 = base();
    const target = s0.players[1];
    const to = target.team === "Lonestar" ? "Valkyra" : "Lonestar";
    const cmds = [cmd(NOW - 5000, { t: "move", steamId: target.steamId, team: to })];
    expect(
      stateAt(DEFAULT_SEED, NOW, cmds, ME).players.find((p) => p.steamId === target.steamId)?.team,
    ).toBe(to);
    const next = stateAt(DEFAULT_SEED, s0.match.endsAt + 60_000, cmds, ME);
    const again = next.players.find((p) => p.steamId === target.steamId);
    const untouched = stateAt(DEFAULT_SEED, s0.match.endsAt + 60_000, [], ME).players.find(
      (p) => p.steamId === target.steamId,
    );
    expect(again?.team).toBe(untouched?.team);
    expect(
      stateAt(
        DEFAULT_SEED,
        NOW,
        [cmd(NOW - 1, { t: "move", steamId: target.steamId, team: target.team })],
        ME,
      ).audit[0].result,
    ).toBe("refused");
  });

  it("whisper and broadcast land in the broadcast log; kill adds a death", () => {
    const p = base().players[2];
    const s = stateAt(
      DEFAULT_SEED,
      NOW,
      [
        cmd(NOW - 3000, { t: "whisper", steamId: p.steamId, text: "watch the flank" }),
        cmd(NOW - 2000, { t: "broadcast", text: "gg" }),
        cmd(NOW - 1000, { t: "kill", steamId: p.steamId }),
      ],
      ME,
    );
    expect(s.broadcastLog).toEqual([
      { at: NOW - 3000, text: "watch the flank", to: p.name },
      { at: NOW - 2000, text: "gg", to: null },
    ]);
    expect(s.players.find((x) => x.steamId === p.steamId)?.deaths).toBe(p.deaths + 1);
  });

  it("map.set and lighting.set override until the next match", () => {
    const s0 = base();
    const cmds = [
      cmd(NOW - 1000, { t: "map.set", map: "ozeti", zone: "houses", lighting: "Night Clear" }),
    ];
    const s = stateAt(DEFAULT_SEED, NOW, cmds, ME);
    expect(s.map).toBe("ozeti");
    expect(s.zone).toBe("houses");
    expect(s.lighting).toBe("Night Clear");
    const next = stateAt(DEFAULT_SEED, s0.match.endsAt + 1000, cmds, ME);
    expect(next.map).toBe(stateAt(DEFAULT_SEED, s0.match.endsAt + 1000, [], ME).map);
    expect(next.lighting).toBe(stateAt(DEFAULT_SEED, s0.match.endsAt + 1000, [], ME).lighting);
    const lit = stateAt(
      DEFAULT_SEED,
      NOW,
      [cmd(NOW - 1, { t: "lighting.set", value: "Dusk Overcast" })],
      ME,
    );
    expect(lit.lighting).toBe("Dusk Overcast");
    expect(lit.map).toBe(s0.map);
  });

  it("match.end restarts the schedule from that instant and records the cut match", () => {
    const s0 = base();
    const at = NOW - 120_000;
    const cmds = [cmd(at, { t: "match.end" })];
    const s = stateAt(DEFAULT_SEED, NOW, cmds, ME);
    expect(s.match.n).toBe(s0.match.n + 1);
    expect(s.match.startedAt).toBe(at);
    expect(s.match.endsAt).toBe(at + MATCH_MS);
    expect(s.history[0]).toMatchObject({
      n: s0.match.n,
      startedAt: s0.match.startedAt,
      endedAt: at,
    });
    expect(s.history[0].final).toEqual(stateAt(DEFAULT_SEED, at - 1, [], ME).scores);
    const restarted = stateAt(DEFAULT_SEED, NOW, [cmd(at, { t: "match.restart" })], ME);
    expect(restarted.match.n).toBe(s0.match.n);
    expect(restarted.match.startedAt).toBe(at);
    expect(restarted.history[0].n).toBe(s0.match.n - 1);
  });

  it("rotation edits, save, reserved slots and settings", () => {
    const cmds = [
      cmd(NOW - 5000, {
        t: "rotation.add",
        entry: {
          map: "ozeti",
          experiences: ["King of the Hill"],
          lighting: "Night Clear",
          zoneAlternator: "houses",
        },
      }),
      cmd(NOW - 4000, { t: "rotation.move", index: 3, direction: "up" }),
      cmd(NOW - 3000, { t: "rotation.remove", index: 0 }),
      cmd(NOW - 2500, { t: "rotation.move", index: 0, direction: "up" }),
      cmd(NOW - 2000, { t: "rotation.save" }),
      cmd(NOW - 1500, { t: "reserved.add", steamId: "76561198000000001" }),
      cmd(NOW - 1400, { t: "reserved.add", steamId: "76561198000000001" }),
      cmd(NOW - 1000, { t: "settings.patch", patch: { scoreTick: 20, rotationMode: "random" } }),
      cmd(NOW - 900, { t: "settings.patch", patch: { scoreTick: 99 } }),
    ];
    const s = stateAt(DEFAULT_SEED, NOW, cmds, ME);
    expect(s.rotation.map((e) => e.map)).toEqual(["bakurani", "ozeti", "ozeti"]);
    expect(s.rotation[1].lighting).toBe("Night Clear");
    expect(s.reserved).toEqual(["76561198000000001"]);
    expect(s.settings).toEqual({ scoreTick: 20, rotationEnabled: true, rotationMode: "random" });
    const results = s.audit
      .filter((a) => a.actor === ME)
      .map((a) => `${a.action}:${a.result}`)
      .reverse();
    expect(results).toEqual([
      "rotation.add:ok",
      "rotation.move:ok",
      "rotation.remove:ok",
      "rotation.move:refused",
      "rotation.save:ok",
      "reserved.add:ok",
      "reserved.add:refused",
      "settings.patch:ok",
      "settings.patch:refused",
    ]);
  });

  it("reset discards everything before it and audits as local only", () => {
    const victim = base().players[0];
    const cmds = [
      cmd(NOW - 5000, { t: "kick", steamId: victim.steamId, reason: "x" }),
      cmd(NOW - 1000, { t: "reset" }),
    ];
    const s = stateAt(DEFAULT_SEED, NOW, cmds, ME);
    expect(s.players.some((p) => p.steamId === victim.steamId)).toBe(true);
    const mine = s.audit.filter((a) => a.mine);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ action: "reset", rcon: null });
    expect(mine[0].detail).toContain("local only");
  });

  it("ignores commands before the reset boundary and from the future", () => {
    const victim = base().players[0];
    const boundary = resetBoundary(NOW);
    const cmds = [
      cmd(boundary - 1, { t: "kick", steamId: victim.steamId, reason: "old" }),
      cmd(NOW + 1000, { t: "kick", steamId: victim.steamId, reason: "future" }),
    ];
    expect(effectiveCommands(cmds, NOW)).toEqual([]);
    expect(stateAt(DEFAULT_SEED, NOW, cmds, ME).audit.filter((a) => a.mine)).toHaveLength(0);
  });
});

describe("resetBoundary", () => {
  it("is the most recent 04:00Z at or before now", () => {
    expect(resetBoundary(Date.UTC(2026, 8, 11, 13, 0, 0))).toBe(Date.UTC(2026, 8, 11, 4, 0, 0));
    expect(resetBoundary(Date.UTC(2026, 8, 11, 3, 59, 59))).toBe(Date.UTC(2026, 8, 10, 4, 0, 0));
    expect(resetBoundary(Date.UTC(2026, 8, 11, 4, 0, 0))).toBe(Date.UTC(2026, 8, 11, 4, 0, 0));
    expect(boundaryDate(Date.UTC(2026, 8, 11, 3, 0, 0))).toBe("2026-09-10");
  });
});

describe("toRcon", () => {
  it("covers every command and returns null for reset", () => {
    const all: AdminCommand[] = [
      { t: "kick", steamId: "1", reason: "r" },
      { t: "kill", steamId: "1" },
      { t: "ban", steamId: "1", reason: "r", evidenceUrl: null, minutes: 60 },
      { t: "unban", steamId: "1" },
      { t: "move", steamId: "1", team: "Valkyra" },
      { t: "whisper", steamId: "1", text: "hi" },
      { t: "broadcast", text: "hi" },
      { t: "map.set", map: "ozeti", zone: "houses", lighting: null },
      { t: "match.end" },
      { t: "match.restart" },
      { t: "lighting.set", value: "Day Clear" },
      {
        t: "rotation.add",
        entry: {
          map: "ozeti",
          experiences: ["King of the Hill"],
          lighting: "Day Clear",
          zoneAlternator: "houses",
        },
      },
      { t: "rotation.remove", index: 1 },
      { t: "rotation.move", index: 1, direction: "down" },
      { t: "rotation.save" },
      { t: "reserved.add", steamId: "1" },
      { t: "reserved.remove", steamId: "1" },
      { t: "settings.patch", patch: { scoreTick: 20 } },
    ];
    const calls = all.map(toRcon);
    expect(calls.every((c) => c !== null)).toBe(true);
    expect(calls.map((c) => `${c!.method} ${c!.path}`)).toEqual([
      "POST /v1/players/1/kick",
      "POST /v1/players/1/kill",
      "POST /v1/bans",
      "DELETE /v1/bans/1",
      "PATCH /v1/players/1",
      "POST /v1/players/1/message",
      "POST /v1/broadcast",
      "POST /v1/match/map",
      "POST /v1/match/end",
      "POST /v1/match/restart",
      "PUT /v1/world/lighting",
      "POST /v1/rotation/entries",
      "DELETE /v1/rotation/entries/1",
      "POST /v1/rotation/entries/1/move",
      "POST /v1/rotation/save",
      "POST /v1/reserved-slots",
      "DELETE /v1/reserved-slots/1",
      "PATCH /v1/settings",
    ]);
    expect(toRcon({ t: "reset" })).toBeNull();
    expect(
      toRcon({ t: "map.set", map: "ozeti", zone: "houses", lighting: "Night Clear" })?.body,
    ).toEqual({
      map: "ozeti",
      experiences: ["King of the Hill"],
      zoneAlternator: "houses",
      lighting: "Night Clear",
    });
  });
});

describe("botName", () => {
  it("is stable, distinct for the first pool and never a real-looking full name", () => {
    const names = new Set<string>();
    for (let i = 0; i < 768; i++) names.add(botName(DEFAULT_SEED, i));
    expect(names.size).toBe(768);
    expect(botName(DEFAULT_SEED, 5)).toBe(botName(DEFAULT_SEED, 5));
    expect(botName(DEFAULT_SEED, 5)).not.toContain(" ");
    expect(botName(DEFAULT_SEED, 900)).toMatch(/_1$/);
  });
});
