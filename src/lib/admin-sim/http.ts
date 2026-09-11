import { site } from "@/config/site";
import { CONTROL_ZONE_IDS, MAP_IDS, type ControlZoneId, type MapId } from "@/lib/terrain/types";
import { hashString } from "./rng";
import { EXPERIENCE, SCORE_TICK_RANGE, SIM_MAPS, mapName } from "./engine";
import {
  LIGHTINGS,
  type AdminCommand,
  type Lighting,
  type SimPlayer,
  type SimState,
} from "./types";

/**
 * The in-browser RCON listener the API console targets. Every one of the 35 operations in
 * `openapi.json` answers here with a body shaped like the spec's schema; writes become
 * simulator commands, so a kick from the console shows up on /demo/admin/live.
 */

export interface SimRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string | null;
}
export interface SimResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  ms: number;
}
export interface SimContext {
  state: SimState;
  push: (cmd: AdminCommand) => void;
  configText: string;
  validate: (text: string) => unknown;
}

const TEAM_COLOR: Record<string, string> = {
  Lonestar: "#5fb8ff",
  Valkyra: "#ff4d4d",
  Manticore: "#46c46e",
};

type Params = Record<string, string>;
type Handler = (
  ctx: SimContext,
  params: Params,
  req: SimRequest,
) => { status: number; body: unknown };

interface Route {
  method: string;
  path: string;
  re: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];
function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const re = new RegExp(
    `^${path.replace(/\{([^}]+)\}/g, (_, k: string) => {
      keys.push(k);
      return "([^/]+)";
    })}/?$`,
  );
  routes.push({ method, path, re, keys, handler });
}

const ok = (message: string) => ({ status: 200, body: { ok: true, message } });
const err = (status: number, code: string, message: string) => ({
  status,
  body: { error: { code, message } },
});

function json(
  req: SimRequest,
): { value: Record<string, unknown> } | { error: ReturnType<typeof err> } {
  if (!req.body || !req.body.trim()) return { value: {} };
  try {
    const v: unknown = JSON.parse(req.body);
    if (typeof v !== "object" || v === null || Array.isArray(v))
      return { error: err(400, "bad_request", "The body must be a JSON object.") };
    return { value: v as Record<string, unknown> };
  } catch {
    return { error: err(400, "bad_request", "The body is not valid JSON.") };
  }
}

function playerOr404(
  ctx: SimContext,
  steamId: string,
): { ok: true; player: SimPlayer } | { ok: false; error: ReturnType<typeof err> } {
  const p = ctx.state.players.find((x) => x.steamId === steamId);
  return p
    ? { ok: true, player: p }
    : { ok: false, error: err(404, "not_found", `No connected player with steamId ${steamId}.`) };
}

export function configRevision(text: string): string {
  return `"${hashString(text).toString(16).padStart(8, "0")}"`;
}

interface ValidationLike {
  ok?: unknown;
  issues?: unknown;
  sections?: unknown;
  stripped?: unknown;
  warnings?: unknown;
}

function configResult(ctx: SimContext, text: string, revision: string) {
  const v = (ctx.validate(text) ?? {}) as ValidationLike;
  const issues = Array.isArray(v.issues) ? v.issues : [];
  const okFlag =
    typeof v.ok === "boolean"
      ? v.ok
      : issues.every((i) => (i as { level?: string }).level !== "error");
  return {
    ok: okFlag,
    revision,
    ...(okFlag
      ? {}
      : {
          error: {
            error: {
              code: "invalid_config",
              message: "The document has errors; nothing was applied.",
            },
          },
        }),
    outcomes: issues,
    changed: Array.isArray(v.sections) ? v.sections : [],
    warnings: [
      ...(Array.isArray(v.warnings) ? v.warnings : []),
      ...(Array.isArray(v.stripped) ? (v.stripped as string[]).map((k) => `stripped ${k}`) : []),
    ],
  };
}

/* ─── Match state / players / meta ─── */

route("GET", "/v1/status", (ctx) => {
  const s = ctx.state;
  const len = s.rotation.length;
  return {
    status: 200,
    body: {
      serverName: s.serverName,
      map: s.map,
      experiences: [EXPERIENCE],
      lighting: s.lighting,
      alternator: s.zone,
      scoreTick: {
        current: s.settings.scoreTick,
        min: SCORE_TICK_RANGE[0],
        max: SCORE_TICK_RANGE[1],
      },
      scoreCap: s.scoreCap,
      matchSeconds: Math.max(0, Math.floor((s.now - s.match.startedAt) / 1000)),
      players: { current: s.players.length, max: s.maxPlayers },
      factionScores: site.game.teams.map((name) => ({
        name,
        colorHex: TEAM_COLOR[name],
        score: s.scores[name],
      })),
      rotation:
        s.settings.rotationEnabled && len
          ? { nowIndex: s.rotationIndex, nextIndex: (s.rotationIndex + 1) % len }
          : null,
    },
  };
});

route("GET", "/v1/players", (ctx) => ({
  status: 200,
  body: {
    players: ctx.state.players.map((p) => ({
      name: p.name,
      steamId: p.steamId,
      faction: p.team,
      kills: p.kills,
      deaths: p.deaths,
      cash: p.cash,
      pingMs: p.pingMs,
    })),
  },
}));

route("GET", "/v1/capabilities", () => ({
  status: 200,
  body: { routes: routes.map((r) => `${r.method} ${r.path}`), config: { writable: true } },
}));

route("GET", "/v1/audit", (ctx, _p, req) => {
  const raw = Number(req.query?.limit ?? 50);
  if (!Number.isInteger(raw) || raw < 1 || raw > 500)
    return err(400, "bad_request", "limit must be an integer from 1 to 500.");
  return {
    status: 200,
    body: {
      entries: ctx.state.audit.slice(0, raw).map((a) => ({
        timestampUtc: new Date(a.at).toISOString(),
        peer: a.actor,
        sessionId: a.id,
        event: `${a.action}${a.result === "refused" ? " (refused)" : ""}`,
        detail: a.target ? `${a.target} · ${a.detail}` : a.detail,
      })),
    },
  };
});

/* ─── Moderation ─── */

route("GET", "/v1/bans", (ctx) => ({
  status: 200,
  body: {
    bans: ctx.state.bans.map((b) => ({
      steamId: b.steamId,
      bannedAtUtc: b.bannedAtUtc,
      bannedBy: b.bannedBy,
      reason: b.reason,
      name: b.name,
      evidenceUrl: b.evidenceUrl,
      expiresAtUtc: new Date(b.expiresAt).toISOString(),
    })),
  },
}));

route("POST", "/v1/bans", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  const steamId = typeof b.value.steamId === "string" ? b.value.steamId.trim() : "";
  if (!/^\d{17}$/.test(steamId))
    return err(400, "bad_request", "steamId must be a 17-digit SteamID64.");
  const reason = typeof b.value.reason === "string" ? b.value.reason : "";
  const evidenceUrl =
    typeof b.value.evidenceUrl === "string" && /^https:\/\//.test(b.value.evidenceUrl)
      ? b.value.evidenceUrl
      : null;
  const minutes = typeof b.value.minutes === "number" ? b.value.minutes : 60;
  ctx.push({ t: "ban", steamId, reason, evidenceUrl, minutes });
  return ok(`Ban recorded for ${steamId}.`);
});

route("DELETE", "/v1/bans/{steamId}", (ctx, p) => {
  if (!ctx.state.bans.some((b) => b.steamId === p.steamId))
    return err(404, "not_found", `No active ban for ${p.steamId}.`);
  ctx.push({ t: "unban", steamId: p.steamId });
  return ok(`Ban lifted for ${p.steamId}.`);
});

route("GET", "/v1/reserved-slots", (ctx) => ({
  status: 200,
  body: { reservedSlots: [...ctx.state.reserved] },
}));

route("POST", "/v1/reserved-slots", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  const steamId = typeof b.value.steamId === "string" ? b.value.steamId.trim() : "";
  if (!/^\d{17}$/.test(steamId))
    return err(400, "bad_request", "steamId must be a 17-digit SteamID64.");
  ctx.push({ t: "reserved.add", steamId });
  return ok(`Reserved slot added for ${steamId}.`);
});

route("DELETE", "/v1/reserved-slots/{steamId}", (ctx, p) => {
  if (!ctx.state.reserved.includes(p.steamId))
    return err(404, "not_found", `No reserved slot for ${p.steamId}.`);
  ctx.push({ t: "reserved.remove", steamId: p.steamId });
  return ok(`Reserved slot removed for ${p.steamId}.`);
});

route("POST", "/v1/players/{steamId}/kick", (ctx, p, req) => {
  const found = playerOr404(ctx, p.steamId);
  if (!found.ok) return found.error;
  const b = json(req);
  if ("error" in b) return b.error;
  ctx.push({
    t: "kick",
    steamId: p.steamId,
    reason: typeof b.value.reason === "string" ? b.value.reason : "",
  });
  return ok(`${found.player.name} kicked.`);
});

route("POST", "/v1/players/{steamId}/kill", (ctx, p) => {
  const found = playerOr404(ctx, p.steamId);
  if (!found.ok) return found.error;
  ctx.push({ t: "kill", steamId: p.steamId });
  return ok(`${found.player.name} killed.`);
});

/* ─── Players ─── */

route("POST", "/v1/players/{steamId}/message", (ctx, p, req) => {
  const found = playerOr404(ctx, p.steamId);
  if (!found.ok) return found.error;
  const b = json(req);
  if ("error" in b) return b.error;
  if (typeof b.value.message !== "string" || !b.value.message.trim())
    return err(400, "bad_request", "message is required.");
  ctx.push({ t: "whisper", steamId: p.steamId, text: b.value.message });
  return ok(`Message sent to ${found.player.name}.`);
});

route("PATCH", "/v1/players/{steamId}", (ctx, p, req) => {
  const found = playerOr404(ctx, p.steamId);
  if (!found.ok) return found.error;
  const b = json(req);
  if ("error" in b) return b.error;
  const faction = typeof b.value.faction === "string" ? b.value.faction : "";
  const team = site.game.teams.find((t) => t.toLowerCase() === faction.toLowerCase());
  if (!team)
    return err(400, "bad_request", `faction must be one of ${site.game.teams.join(", ")}.`);
  ctx.push({ t: "move", steamId: p.steamId, team });
  return ok(`${found.player.name} moved to ${team}.`);
});

route("POST", "/v1/broadcast", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  if (typeof b.value.message !== "string" || !b.value.message.trim())
    return err(400, "bad_request", "message is required.");
  ctx.push({ t: "broadcast", text: b.value.message });
  return ok("Broadcast sent.");
});

/* ─── Match control ─── */

function parseLighting(v: unknown): Lighting | null {
  return typeof v === "string"
    ? (LIGHTINGS.find((l) => l.toLowerCase() === v.toLowerCase()) ?? null)
    : null;
}
function parseMap(v: unknown): MapId | null {
  if (typeof v !== "string") return null;
  const key = v.trim().toLowerCase();
  return MAP_IDS.find((m) => m === key || mapName(m).toLowerCase() === key) ?? null;
}
function parseZone(v: unknown): ControlZoneId | null {
  if (typeof v !== "string") return null;
  const key = v.trim().toLowerCase();
  return CONTROL_ZONE_IDS.find((z) => z === key) ?? null;
}

route("POST", "/v1/match/map", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  const map = parseMap(b.value.map);
  if (!map) return err(400, "bad_request", `map must be one of ${MAP_IDS.join(", ")}.`);
  const zone = b.value.zoneAlternator === undefined ? "default" : parseZone(b.value.zoneAlternator);
  if (!zone)
    return err(400, "bad_request", `zoneAlternator must be one of ${CONTROL_ZONE_IDS.join(", ")}.`);
  const lighting = b.value.lighting === undefined ? null : parseLighting(b.value.lighting);
  if (b.value.lighting !== undefined && !lighting)
    return err(400, "bad_request", `lighting must be one of ${LIGHTINGS.join(", ")}.`);
  ctx.push({ t: "map.set", map, zone, lighting });
  return ok(`Map set to ${mapName(map)}.`);
});

route("POST", "/v1/match/end", (ctx) => {
  ctx.push({ t: "match.end" });
  return ok("Match ended.");
});

route("POST", "/v1/match/restart", (ctx) => {
  ctx.push({ t: "match.restart" });
  return ok("Match restarted.");
});

route("PUT", "/v1/world/lighting", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  const lighting = parseLighting(b.value.lighting);
  if (!lighting) return err(400, "bad_request", `lighting must be one of ${LIGHTINGS.join(", ")}.`);
  ctx.push({ t: "lighting.set", value: lighting });
  return ok(`Lighting set to ${lighting}.`);
});

/* ─── Rotation ─── */

route("GET", "/v1/rotation", (ctx) => ({
  status: 200,
  body: {
    enabled: ctx.state.settings.rotationEnabled,
    mode: ctx.state.settings.rotationMode,
    entries: ctx.state.rotation,
  },
}));

route("POST", "/v1/rotation/entries", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  const map = parseMap(b.value.map);
  if (!map) return err(400, "bad_request", `map must be one of ${MAP_IDS.join(", ")}.`);
  const zone = b.value.zoneAlternator === undefined ? "default" : parseZone(b.value.zoneAlternator);
  if (!zone)
    return err(400, "bad_request", `zoneAlternator must be one of ${CONTROL_ZONE_IDS.join(", ")}.`);
  const lighting = b.value.lighting === undefined ? "Day Clear" : parseLighting(b.value.lighting);
  if (!lighting) return err(400, "bad_request", `lighting must be one of ${LIGHTINGS.join(", ")}.`);
  const experiences =
    Array.isArray(b.value.experiences) && b.value.experiences.length
      ? b.value.experiences.map(String)
      : [EXPERIENCE];
  ctx.push({ t: "rotation.add", entry: { map, experiences, lighting, zoneAlternator: zone } });
  return ok(`${mapName(map)} added to the rotation.`);
});

function index(p: Params, ctx: SimContext) {
  const i = Number(p.i);
  if (!Number.isInteger(i) || i < 0 || i >= ctx.state.rotation.length) return null;
  return i;
}

route("DELETE", "/v1/rotation/entries/{i}", (ctx, p) => {
  const i = index(p, ctx);
  if (i === null) return err(404, "not_found", `No rotation entry at index ${p.i}.`);
  ctx.push({ t: "rotation.remove", index: i });
  return ok(`Rotation entry ${i} removed.`);
});

route("POST", "/v1/rotation/entries/{i}/move", (ctx, p, req) => {
  const i = index(p, ctx);
  if (i === null) return err(404, "not_found", `No rotation entry at index ${p.i}.`);
  const b = json(req);
  if ("error" in b) return b.error;
  if (b.value.direction !== "up" && b.value.direction !== "down")
    return err(400, "bad_request", "direction must be up or down.");
  ctx.push({ t: "rotation.move", index: i, direction: b.value.direction });
  return ok(`Rotation entry ${i} moved ${b.value.direction}.`);
});

route("POST", "/v1/rotation/save", (ctx) => {
  ctx.push({ t: "rotation.save" });
  return ok("Rotation saved to ServerSettings.ini (simulated).");
});

/* ─── Config ─── */

route("PATCH", "/v1/settings", (ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  const patch: Record<string, unknown> = {};
  if (b.value.scoreTick !== undefined) {
    const v = Number(b.value.scoreTick);
    if (!Number.isInteger(v) || v < SCORE_TICK_RANGE[0] || v > SCORE_TICK_RANGE[1])
      return err(
        400,
        "bad_request",
        `scoreTick must be an integer from ${SCORE_TICK_RANGE[0]} to ${SCORE_TICK_RANGE[1]}.`,
      );
    patch.scoreTick = v;
  }
  if (b.value.rotationEnabled !== undefined) {
    if (typeof b.value.rotationEnabled !== "boolean")
      return err(400, "bad_request", "rotationEnabled must be a boolean.");
    patch.rotationEnabled = b.value.rotationEnabled;
  }
  if (b.value.rotationMode !== undefined) {
    if (b.value.rotationMode !== "ordered" && b.value.rotationMode !== "random")
      return err(400, "bad_request", "rotationMode must be ordered or random.");
    patch.rotationMode = b.value.rotationMode;
  }
  if (Object.keys(patch).length === 0)
    return err(
      400,
      "bad_request",
      "Nothing to patch: send scoreTick, rotationEnabled or rotationMode.",
    );
  ctx.push({ t: "settings.patch", patch });
  return ok("Settings patched.");
});

route("GET", "/v1/config", (ctx) => {
  const v = (ctx.validate(ctx.configText) ?? {}) as ValidationLike;
  return {
    status: 200,
    body: {
      revision: configRevision(ctx.configText),
      writable: true,
      text: ctx.configText,
      sections: Array.isArray(v.sections) ? v.sections : [],
      warnings: Array.isArray(v.warnings) ? v.warnings : [],
    },
  };
});

route("PUT", "/v1/config", (ctx, _p, req) => {
  const text = req.body ?? "";
  if (!text.trim())
    return err(400, "bad_request", "Send the ServerSettings.ini document as text/plain.");
  const current = configRevision(ctx.configText);
  const ifMatch = req.headers?.["if-match"];
  const force = req.query?.force === "true" || req.query?.force === "1";
  if (ifMatch && ifMatch !== current && !force) {
    return {
      status: 412,
      body: {
        ok: false,
        revision: current,
        error: {
          error: {
            code: "revision_conflict",
            message: `The server is at revision ${current}; you sent ${ifMatch}. Re-read the config or pass ?force=true.`,
          },
        },
        outcomes: [],
        changed: [],
        warnings: [],
      },
    };
  }
  const result = configResult(ctx, text, configRevision(text));
  return {
    status: 200,
    body: result.ok
      ? {
          ...result,
          warnings: [
            ...result.warnings,
            "Applied to the simulator only; the file on disk is unchanged.",
          ],
        }
      : { ...result, revision: current },
  };
});

route("POST", "/v1/config/validate", (ctx, _p, req) => {
  const text = req.body ?? "";
  if (!text.trim())
    return err(400, "bad_request", "Send the ServerSettings.ini document as text/plain.");
  return { status: 200, body: configResult(ctx, text, configRevision(ctx.configText)) };
});

/* ─── Catalog ─── */

route("GET", "/v1/catalog/maps", () => ({ status: 200, body: { maps: SIM_MAPS } }));
route("GET", "/v1/catalog/lightings", () => ({ status: 200, body: { lightings: [...LIGHTINGS] } }));
route("GET", "/v1/catalog/experiences", () => ({
  status: 200,
  body: { experiences: [EXPERIENCE] },
}));
route("GET", "/v1/catalog/maps/{id}/experiences", (_ctx, p) => {
  const map = parseMap(p.id);
  if (!map) return err(404, "not_found", `Unknown map ${p.id}.`);
  return {
    status: 200,
    body: { ok: true, message: `${mapName(map)} plays ${EXPERIENCE}.`, experiences: [EXPERIENCE] },
  };
});
route("GET", "/v1/catalog/maps/{id}/alternators", (_ctx, p) => {
  const map = parseMap(p.id);
  if (!map) return err(404, "not_found", `Unknown map ${p.id}.`);
  return {
    status: 200,
    body: {
      ok: true,
      message: `${mapName(map)} has ${CONTROL_ZONE_IDS.length - 1} zone alternators.`,
      alternators: CONTROL_ZONE_IDS.filter((z) => z !== "none"),
    },
  };
});

/* ─── Sponsor ─── */

route("GET", "/v1/sponsor", () => ({ status: 200, body: { imageUrl: "" } }));
route("PUT", "/v1/sponsor", (_ctx, _p, req) => {
  const b = json(req);
  if ("error" in b) return b.error;
  if (typeof b.value.imageUrl !== "string" || !/^https?:\/\//.test(b.value.imageUrl))
    return err(400, "bad_request", "imageUrl must be an http(s) URL.");
  return ok("Accepted. The simulator does not display a sponsor banner.");
});

/** Every `METHOD /path` the simulator answers (the 35 operations in openapi.json). */
export const SIM_ROUTES: readonly string[] = routes.map((r) => `${r.method} ${r.path}`);

function lowerHeaders(h: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h ?? {})) out[k.toLowerCase()] = v;
  return out;
}

export function handleRcon(req: SimRequest, ctx: SimContext): SimResponse {
  const [rawPath, rawQuery] = req.path.split("?", 2);
  const query: Record<string, string> = { ...(req.query ?? {}) };
  if (rawQuery) for (const [k, v] of new URLSearchParams(rawQuery)) query[k] = v;
  const headers = lowerHeaders(req.headers);
  const method = req.method.toUpperCase();
  const path = rawPath.replace(/\/+$/, "") || "/";
  const ms = 2 + (hashString(`${method} ${path}`) % 9);

  const respond = (status: number, body: unknown): SimResponse => ({
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-simulated": "wardogs.tech" },
    body: JSON.stringify(body, null, 2),
    ms,
  });

  const auth = headers.authorization ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(auth);
  if (!m)
    return respond(401, {
      error: {
        code: "unauthorized",
        message:
          "Send the RCON password as `Authorization: Bearer <password>`. Any token works against the simulator.",
      },
    });

  let pathMatched = false;
  for (const r of routes) {
    const hit = r.re.exec(path);
    if (!hit) continue;
    pathMatched = true;
    if (r.method !== method) continue;
    const params: Params = {};
    r.keys.forEach((k, i) => {
      try {
        params[k] = decodeURIComponent(hit[i + 1]);
      } catch {
        params[k] = hit[i + 1];
      }
    });
    const out = r.handler(ctx, params, { ...req, query, headers });
    return respond(out.status, out.body);
  }
  if (pathMatched)
    return respond(405, {
      error: { code: "method_not_allowed", message: `${method} is not supported on ${path}.` },
    });
  return respond(404, {
    error: { code: "not_found", message: `No route ${method} ${path}. See GET /v1/capabilities.` },
  });
}
