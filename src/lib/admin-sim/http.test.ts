import { describe, expect, it } from "vitest";
import spec from "@/content/openapi.json";
import { parseSpec, exampleFor, fillPath, type SchemaNode } from "@/lib/openapi/parse";
import { DEFAULT_SEED, stateAt } from "./engine";
import { SIM_ROUTES, configRevision, handleRcon, type SimRequest } from "./http";
import type { AdminCommand, TimedCommand } from "./types";

const NOW = Date.UTC(2026, 8, 11, 13, 4, 31);
const parsed = parseSpec(spec);
const CONFIG = "[/Script/WDGame.WDGameSession]\nServerName=Test\n";

/** Structural check: every property present in the schema exists on the value with a compatible type. */
function satisfies(value: unknown, schema: SchemaNode, path = "$"): string[] {
  const problems: string[] = [];
  if (value === null) {
    if (!schema.nullable) problems.push(`${path} is null`);
    return problems;
  }
  if (schema.type === "any") return problems;
  switch (schema.type) {
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return [`${path} not an object`];
      for (const [k, sub] of Object.entries(schema.properties ?? {})) {
        const v = (value as Record<string, unknown>)[k];
        if (v === undefined) {
          // `error` is only present on a failed ConfigResult; everything else must be there.
          if (k !== "error") problems.push(`${path}.${k} missing`);
          continue;
        }
        problems.push(...satisfies(v, sub, `${path}.${k}`));
      }
      return problems;
    case "array":
      if (!Array.isArray(value)) return [`${path} not an array`];
      if (schema.items)
        value.forEach((v, i) => problems.push(...satisfies(v, schema.items!, `${path}[${i}]`)));
      return problems;
    case "integer":
    case "number":
      return typeof value === "number" ? [] : [`${path} not a number`];
    case "boolean":
      return typeof value === "boolean" ? [] : [`${path} not a boolean`];
    default:
      return typeof value === "string" ? [] : [`${path} not a string`];
  }
}

function ctxWith(commands: TimedCommand[] = [], me = "Operator 41E3") {
  const pushed: AdminCommand[] = [];
  const state = stateAt(DEFAULT_SEED, NOW, commands, me);
  return {
    pushed,
    ctx: {
      state,
      push: (cmd: AdminCommand) => {
        pushed.push(cmd);
      },
      configText: CONFIG,
      validate: (text: string) => ({
        ok: !/ScorePeriod=40/.test(text),
        issues: /ScorePeriod=40/.test(text)
          ? [{ level: "error", code: "range", message: "ScorePeriod out of range", line: 1 }]
          : [],
        sections: [{ name: "a", keys: [] }],
        stripped: [],
        warnings: [],
      }),
    },
  };
}

const auth = { authorization: "Bearer any-token" };
const send = (req: SimRequest, c = ctxWith()) => {
  const res = handleRcon({ ...req, headers: { ...auth, ...(req.headers ?? {}) } }, c.ctx);
  return { res, json: JSON.parse(res.body) as Record<string, unknown>, pushed: c.pushed };
};

describe("handleRcon", () => {
  it("answers every operation in openapi.json with a body that satisfies the response schema", () => {
    expect(SIM_ROUTES).toHaveLength(35);
    expect(new Set(SIM_ROUTES)).toEqual(
      new Set(parsed.endpoints.map((e) => `${e.method.toUpperCase()} ${e.path}`)),
    );

    const c = ctxWith();
    const player = c.ctx.state.players[0];
    const ban = ctxWith([
      {
        id: "b1",
        at: NOW - 1000,
        actor: "x",
        cmd: { t: "ban", steamId: player.steamId, reason: "r", evidenceUrl: null, minutes: 60 },
      },
    ]);
    const reserved = ctxWith([
      { id: "r1", at: NOW - 1000, actor: "x", cmd: { t: "reserved.add", steamId: player.steamId } },
    ]);

    for (const e of parsed.endpoints) {
      const values: Record<string, unknown> = {
        steamId: player.steamId,
        i: 0,
        id: "zestafona",
        "If-Match": configRevision(CONFIG),
      };
      const body = e.body
        ? e.body.contentType === "text/plain"
          ? CONFIG
          : JSON.stringify({ ...(exampleFor(e.body.schema) as object), steamId: player.steamId })
        : null;
      const use = e.path.startsWith("/v1/bans/{")
        ? ban
        : e.path.startsWith("/v1/reserved-slots/{")
          ? reserved
          : ctxWith();
      const res = handleRcon(
        {
          method: e.method,
          path: fillPath(e.path, values),
          headers: {
            ...auth,
            ...(e.body ? { "content-type": e.body.contentType } : {}),
            ...(e.id === "put-v1-config" ? { "If-Match": configRevision(CONFIG) } : {}),
          },
          body,
        },
        use.ctx,
      );
      expect(res.status, `${e.method} ${e.path} -> ${res.body}`).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.ms).toBeGreaterThan(0);
      const schema = e.responses.find((r) => r.status === "200")?.schema;
      if (schema && schema.properties) {
        const problems = satisfies(JSON.parse(res.body), schema);
        expect(problems, `${e.method} ${e.path}: ${problems.join(", ")}`).toEqual([]);
      }
      if (e.write)
        expect(
          use.pushed.length +
            (e.id === "put-v1-sponsor" || e.path.startsWith("/v1/config") ? 1 : 0),
        ).toBeGreaterThan(0);
    }
  });

  it("returns 401 without a bearer token and 404 for unknown routes, 405 for a wrong method", () => {
    const { ctx } = ctxWith();
    const noAuth = handleRcon({ method: "GET", path: "/v1/status" }, ctx);
    expect(noAuth.status).toBe(401);
    expect(JSON.parse(noAuth.body)).toMatchObject({ error: { code: "unauthorized" } });
    expect(
      handleRcon({ method: "GET", path: "/v1/status", headers: { Authorization: "Bearer " } }, ctx)
        .status,
    ).toBe(401);
    expect(send({ method: "GET", path: "/v1/nope" }).json).toMatchObject({
      error: { code: "not_found" },
    });
    expect(send({ method: "DELETE", path: "/v1/status" }).res.status).toBe(405);
  });

  it("status reflects the simulator and honours a query string in the path", () => {
    const { json } = send({ method: "GET", path: "/v1/status" });
    expect(json.serverName).toBe("Wardogs Demo Server");
    expect((json.players as { current: number }).current).toBeGreaterThanOrEqual(13);
    expect((json.factionScores as unknown[]).length).toBe(3);
    const audit = send({ method: "GET", path: "/v1/audit?limit=2" });
    expect((audit.json.entries as unknown[]).length).toBeLessThanOrEqual(2);
    expect(send({ method: "GET", path: "/v1/audit", query: { limit: "0" } }).res.status).toBe(400);
  });

  it("writes push simulator commands and validate input", () => {
    const c = ctxWith();
    const p = c.ctx.state.players[1];
    const kick = send(
      {
        method: "POST",
        path: `/v1/players/${p.steamId}/kick`,
        body: JSON.stringify({ reason: "afk" }),
      },
      c,
    );
    expect(kick.res.status).toBe(200);
    expect(c.pushed).toEqual([{ t: "kick", steamId: p.steamId, reason: "afk" }]);
    expect(send({ method: "POST", path: "/v1/players/123/kick", body: "{}" }).res.status).toBe(404);
    expect(
      send({ method: "POST", path: `/v1/players/${p.steamId}/kick`, body: "{oops" }).res.status,
    ).toBe(400);
    expect(
      send({
        method: "PATCH",
        path: `/v1/players/${p.steamId}`,
        body: JSON.stringify({ faction: "Pirates" }),
      }).res.status,
    ).toBe(400);
    expect(
      send({
        method: "POST",
        path: "/v1/match/map",
        body: JSON.stringify({ map: "Ozeti", zoneAlternator: "houses", lighting: "Night Clear" }),
      }).pushed,
    ).toEqual([{ t: "map.set", map: "ozeti", zone: "houses", lighting: "Night Clear" }]);
    expect(
      send({ method: "POST", path: "/v1/match/map", body: JSON.stringify({ map: "moon" }) }).res
        .status,
    ).toBe(400);
    expect(
      send({ method: "PATCH", path: "/v1/settings", body: JSON.stringify({ scoreTick: 40 }) }).res
        .status,
    ).toBe(400);
    expect(
      send({
        method: "PATCH",
        path: "/v1/settings",
        body: JSON.stringify({ scoreTick: 20, rotationMode: "random" }),
      }).pushed,
    ).toEqual([{ t: "settings.patch", patch: { scoreTick: 20, rotationMode: "random" } }]);
    expect(
      send({
        method: "POST",
        path: "/v1/rotation/entries/9/move",
        body: JSON.stringify({ direction: "up" }),
      }).res.status,
    ).toBe(404);
    expect(
      send({ method: "POST", path: "/v1/bans", body: JSON.stringify({ steamId: "nope" }) }).res
        .status,
    ).toBe(400);
    expect(send({ method: "DELETE", path: "/v1/bans/76561198000000009" }).res.status).toBe(404);
    expect(send({ method: "GET", path: "/v1/catalog/maps/mars/experiences" }).res.status).toBe(404);
  });

  it("config: revision, If-Match conflict, force, and validation outcomes", () => {
    const rev = configRevision(CONFIG);
    const get = send({ method: "GET", path: "/v1/config" });
    expect(get.json.revision).toBe(rev);
    expect(get.json.text).toBe(CONFIG);
    const conflict = send({
      method: "PUT",
      path: "/v1/config",
      headers: { "If-Match": '"deadbeef"' },
      body: CONFIG,
    });
    expect(conflict.res.status).toBe(412);
    expect(conflict.json.ok).toBe(false);
    const forced = send({
      method: "PUT",
      path: "/v1/config?force=true",
      headers: { "If-Match": '"deadbeef"' },
      body: CONFIG,
    });
    expect(forced.res.status).toBe(200);
    expect(forced.json.ok).toBe(true);
    const bad = send({
      method: "POST",
      path: "/v1/config/validate",
      body: "[x]\nScorePeriod=40\n",
    });
    expect(bad.json.ok).toBe(false);
    expect((bad.json.outcomes as unknown[]).length).toBe(1);
    expect(send({ method: "PUT", path: "/v1/config", body: "" }).res.status).toBe(400);
  });
});
