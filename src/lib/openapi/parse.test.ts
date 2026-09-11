import { describe, expect, it } from "vitest";
import spec from "@/content/openapi.json";
import {
  buildUrl,
  endpointId,
  exampleFor,
  fillPath,
  parseSpec,
  toCurl,
  toFetch,
  toPowerShell,
  type SchemaNode,
} from "./parse";

const parsed = parseSpec(spec);

function walk(node: SchemaNode, visit: (n: SchemaNode) => void) {
  visit(node);
  if (node.properties) Object.values(node.properties).forEach((n) => walk(n, visit));
  if (node.items) walk(node.items, visit);
}

describe("parseSpec on the real spec", () => {
  it("reads info and the server with variables substituted", () => {
    expect(parsed.info).toEqual({
      title: "Wardogs RCON API (unofficial)",
      version: "0.27",
      updated: "2026-09-10",
    });
    expect(parsed.servers[0].url).toBe("https://your-server-host:7776");
  });

  it("finds 31 paths and 35 operations, every one tagged and authenticated", () => {
    expect(new Set(parsed.endpoints.map((e) => e.path)).size).toBe(31);
    expect(parsed.endpoints).toHaveLength(35);
    for (const e of parsed.endpoints) {
      expect(parsed.tags).toContain(e.tag);
      expect(e.tag).not.toBe("Other");
      expect(e.auth).toBe(true);
      expect(e.write).toBe(e.method !== "get");
      expect(e.summary.length).toBeGreaterThan(0);
    }
    expect(new Set(parsed.endpoints.map((e) => e.id)).size).toBe(35);
    expect(parsed.tags).toEqual([
      "Match state",
      "Players",
      "Moderation",
      "Match control",
      "Rotation",
      "Catalog",
      "Config",
      "Meta",
      "Sponsor",
    ]);
  });

  it("resolves every $ref so no schema node carries one", () => {
    for (const e of parsed.endpoints) {
      if (e.body) walk(e.body.schema, (n) => expect(n).not.toHaveProperty("$ref"));
      for (const r of e.responses)
        if (r.schema) walk(r.schema, (n) => expect(n).not.toHaveProperty("$ref"));
    }
    const status = parsed.endpoints.find((e) => e.id === "get-v1-status")!;
    const items = status.responses[0].schema!.properties!.factionScores.items!;
    expect(items.properties).toHaveProperty("colorHex");
  });

  it("keeps params in path → query → header order with path params required", () => {
    const put = parsed.endpoints.find((e) => e.id === "put-v1-config")!;
    expect(put.params.map((p) => `${p.in}:${p.name}`)).toEqual([
      "query:force",
      "query:fullApply",
      "header:If-Match",
    ]);
    expect(put.body).toEqual({
      contentType: "text/plain",
      schema: { type: "string" },
      required: true,
    });
    const kick = parsed.endpoints.find((e) => e.id === "post-v1-players-steamId-kick")!;
    expect(kick.params[0]).toMatchObject({ name: "steamId", in: "path", required: true });
    expect(kick.body?.schema.properties).toHaveProperty("reason");
    const audit = parsed.endpoints.find((e) => e.id === "get-v1-audit")!;
    expect(audit.params[0].schema).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 500,
      default: 50,
    });
    expect(put.responses.map((r) => r.status)).toEqual(["200", "412"]);
  });

  it("tolerates garbage input", () => {
    expect(parseSpec(null)).toEqual({
      info: { title: "", version: "", updated: "" },
      servers: [],
      tags: [],
      endpoints: [],
    });
    expect(parseSpec({ paths: { "/x": { get: {} } } }).endpoints[0]).toMatchObject({
      id: "get-x",
      tag: "Other",
      auth: false,
    });
    expect(endpointId("POST", "/v1/players/{steamId}/kick")).toBe("post-v1-players-steamId-kick");
  });
});

describe("exampleFor", () => {
  it("fills required fields, enums at their first value, and named fields with realistic values", () => {
    const move = parsed.endpoints.find((e) => e.id === "post-v1-rotation-entries-i-move")!;
    expect(exampleFor(move.body!.schema)).toEqual({ direction: "up" });
    const ban = parsed.endpoints.find((e) => e.id === "post-v1-bans")!;
    const ex = exampleFor(ban.body!.schema) as Record<string, unknown>;
    for (const k of ban.body!.schema.required ?? []) expect(ex).toHaveProperty(k);
    expect(ex.steamId).toMatch(/^7656119\d{10}$/);
    const mapSel = parsed.endpoints.find((e) => e.id === "post-v1-match-map")!;
    expect(exampleFor(mapSel.body!.schema)).toEqual({
      map: "zestafona",
      experiences: ["King of the Hill"],
      lighting: "Day Clear",
      zoneAlternator: "default",
    });
    expect(exampleFor({ type: "string" })).toBe("string");
    expect(exampleFor({ type: "integer", minimum: 18, maximum: 30 })).toBe(18);
    expect(exampleFor({ type: "boolean" })).toBe(false);
    expect(exampleFor({ type: "array", items: { type: "string", enum: ["a", "b"] } })).toEqual([
      "a",
    ]);
    expect(exampleFor({ type: "object" })).toEqual({});
  });
});

describe("snippets", () => {
  const kick = parsed.endpoints.find((e) => e.id === "post-v1-players-steamId-kick")!;
  const put = parsed.endpoints.find((e) => e.id === "put-v1-config")!;
  const status = parsed.endpoints.find((e) => e.id === "get-v1-status")!;
  const values = { steamId: "76561198000000001" };
  const body = { reason: "team killing" };

  it("fillPath and buildUrl", () => {
    expect(fillPath("/v1/players/{steamId}/kick", values)).toBe(
      "/v1/players/76561198000000001/kick",
    );
    expect(fillPath("/v1/players/{steamId}", {})).toBe("/v1/players/{steamId}");
    expect(buildUrl(put, "https://h:7776/", { force: true, fullApply: "" })).toBe(
      "https://h:7776/v1/config?force=true",
    );
  });

  it("curl carries method, path, token header and JSON body", () => {
    const s = toCurl(kick, "https://h:7776", "secret", values, body);
    expect(s).toContain("curl -X POST 'https://h:7776/v1/players/76561198000000001/kick'");
    expect(s).toContain("Authorization: Bearer secret");
    expect(s).toContain("Content-Type: application/json");
    expect(s).toContain('"reason": "team killing"');
    expect(toCurl(status, "https://h:7776", "", {}, null)).toContain("Bearer <token>");
    expect(
      toCurl(put, "https://h:7776", "t", { "If-Match": '"abc"' }, "[Section]\nKey=1"),
    ).toContain(`-H 'If-Match: "abc"'`);
  });

  it("fetch and PowerShell carry the same essentials", () => {
    const f = toFetch(kick, "https://h:7776", "secret", values, body);
    expect(f).toContain('method: "POST"');
    expect(f).toContain("/v1/players/76561198000000001/kick");
    expect(f).toContain('Authorization: "Bearer secret"');
    expect(f).toContain("body:");
    const p = toPowerShell(kick, "https://h:7776", "secret", values, body);
    expect(p).toContain("Invoke-RestMethod -Method Post");
    expect(p).toContain("Authorization = 'Bearer secret'");
    expect(p).toContain("-ContentType 'application/json'");
    expect(toPowerShell(status, "https://h:7776", "s", {}, null)).not.toContain("-Body");
    expect(toFetch(status, "https://h:7776", "s", {}, null)).not.toContain("body:");
  });
});
