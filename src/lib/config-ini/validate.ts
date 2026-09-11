/**
 * ServerSettings.ini parser and validator (§3.10). Mirrors what the server's
 * `POST /v1/config/validate` reports: unknown sections and keys are stripped (a warning),
 * out-of-range or mistyped values are errors, and a handful of cross-key rules catch the
 * mistakes that stop a listener from starting. Pure; unit-tested; zod-backed.
 */
import { z } from "zod";

export interface IniIssue {
  line: number | null;
  level: "error" | "warning";
  code: string;
  message: string;
  key?: string;
}
export interface IniValidation {
  ok: boolean;
  issues: IniIssue[];
  sections: { name: string; keys: { key: string; value: string; line: number }[] }[];
  stripped: string[];
  warnings: string[];
}

export type IniKeyType = "bool" | "int" | "string" | "list";

/** Every honoured section and key, with the default and when a change applies (§4.9 / 08). */
export const INI_KEYS: {
  section: string;
  key: string;
  default: string;
  applies: string;
  description: string;
  type: IniKeyType;
  range?: [number, number];
}[] = [
  // Session
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerName",
    default: "—",
    applies: "immediately",
    description: "Name in the server browser.",
    type: "string",
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerPassword",
    default: "(empty)",
    applies: "next restart",
    description: "Join password. Empty = open server.",
    type: "string",
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerMinPlayerCash",
    default: "0",
    applies: "next restart",
    description: "Minimum cash to join. 0 = no limit.",
    type: "int",
    range: [0, 2_147_483_647],
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerMaxPlayerCash",
    default: "0",
    applies: "next restart",
    description: "Maximum cash to join. 0 = no limit.",
    type: "int",
    range: [0, 2_147_483_647],
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerMinPlayerLevel",
    default: "0",
    applies: "next restart",
    description: "Minimum level to join. 0 = no limit.",
    type: "int",
    range: [0, 1000],
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerMaxPlayerLevel",
    default: "0",
    applies: "next restart",
    description: "Maximum level to join. 0 = no limit.",
    type: "int",
    range: [0, 1000],
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "ServerImageURL",
    default: "—",
    applies: "pending",
    description: "Sponsor banner. 1024×256 PNG/JPEG on the allow-list.",
    type: "string",
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "MaxReservedSlots",
    default: "20",
    applies: "immediately",
    description: "How many reserved slots exist.",
    type: "int",
    range: [0, 128],
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "+DefaultReservedPlayerIds",
    default: "—",
    applies: "—",
    description: "One line per SteamID64. The RCON reserve command edits these.",
    type: "list",
  },
  {
    section: "/Script/WDGame.WDGameSession",
    key: "+DefaultBannedPlayerIds",
    default: "—",
    applies: "—",
    description: "One line per SteamID64. The RCON ban / unban commands edit these.",
    type: "list",
  },
  // Player slots
  {
    section: "/Script/Engine.GameSession",
    key: "MaxPlayers",
    default: "128",
    applies: "immediately",
    description: "Total player slots. Clamped by a developer-set min/max.",
    type: "int",
    range: [1, 128],
  },
  // Pre-match
  {
    section: "MatchState.PreMatch.WaitingForPlayers.PlayerCount",
    key: "MinimumRequiredPlayers",
    default: "60",
    applies: "next match",
    description: "Players required before pre-match becomes a live match.",
    type: "int",
    range: [0, 128],
  },
  // KOTH scoring
  {
    section: "MatchState.Playing.KOTH",
    key: "ScorePeriod",
    default: "24",
    applies: "next match",
    description: "Seconds between score ticks (18–30). A faster tick pays less each time.",
    type: "int",
    range: [18, 30],
  },
  // Team balancing
  {
    section: "/Script/WDGame.WDGameStateSession",
    key: "bLockOverpopulatedTeamsConfig",
    default: "true",
    applies: "next match",
    description: "Stop players joining a team that already leads by the threshold.",
    type: "bool",
  },
  {
    section: "/Script/WDGame.WDGameStateSession",
    key: "OverpopulatedTeamThresholdConfig",
    default: "2",
    applies: "next match",
    description: "How many players ahead a team must be before it locks.",
    type: "int",
    range: [1, 128],
  },
  // Map rotation
  {
    section: "/Script/WDGame.WDServerMapRotationSettings",
    key: "bEnabled",
    default: "true",
    applies: "immediately",
    description: "Advance through the rotation after each match.",
    type: "bool",
  },
  {
    section: "/Script/WDGame.WDServerMapRotationSettings",
    key: "RotationMode",
    default: "Ordered",
    applies: "immediately",
    description: "Ordered walks top to bottom; Random picks each next entry.",
    type: "string",
  },
  {
    section: "/Script/WDGame.WDServerMapRotationSettings",
    key: "+RotationEntries",
    default: "—",
    applies: "immediately",
    description: "One map entry per line (format below).",
    type: "list",
  },
  // RCON listener
  {
    section: "/Script/WDRCON.WDRCONSettings",
    key: "bEnabled",
    default: "false",
    applies: "next restart",
    description: "Start the RCON listener. Off by default.",
    type: "bool",
  },
  {
    section: "/Script/WDRCON.WDRCONSettings",
    key: "BindAddress",
    default: "127.0.0.1",
    applies: "next restart",
    description: "Loopback = plaintext ok; 0.0.0.0 = all interfaces, needs TLS.",
    type: "string",
  },
  {
    section: "/Script/WDRCON.WDRCONSettings",
    key: "Port",
    default: "7776",
    applies: "next restart",
    description: "RCON port. Or launch with -RCONPort=.",
    type: "int",
    range: [1, 65535],
  },
  {
    section: "/Script/WDRCON.WDRCONSettings",
    key: "Password",
    default: "(empty)",
    applies: "next restart",
    description: "Plaintext password. If empty, auto-generated to Saved/RCON/ADMIN-PASSWORD.txt.",
    type: "string",
  },
  {
    section: "/Script/WDRCON.WDRCONSettings",
    key: "PasswordHash",
    default: '""',
    applies: "next restart",
    description: "From WardogsServer -GenerateRCONHash=<password>; wins over Password.",
    type: "string",
  },
];

/** Section display names, in template order (used by the docs table and the viewer). */
export const INI_SECTIONS: { name: string; label: string }[] = [
  { name: "/Script/WDGame.WDGameSession", label: "Session" },
  { name: "/Script/Engine.GameSession", label: "Player slots" },
  { name: "MatchState.PreMatch.WaitingForPlayers.PlayerCount", label: "Pre-match" },
  { name: "MatchState.Playing.KOTH", label: "KOTH scoring" },
  { name: "/Script/WDGame.WDGameStateSession", label: "Team balancing" },
  { name: "/Script/WDGame.WDServerMapRotationSettings", label: "Map rotation" },
  { name: "/Script/WDRCON.WDRCONSettings", label: "The RCON listener" },
];

const RCON = "/Script/WDRCON.WDRCONSettings";
const SESSION = "/Script/WDGame.WDGameSession";
const ROTATION = "/Script/WDGame.WDServerMapRotationSettings";
const ROTATION_MODES = ["Ordered", "Random"];

/* ---- parsing ------------------------------------------------------------------------- */

const isComment = (s: string) => s.startsWith(";") || s.startsWith("#") || s.startsWith("//");

/** Strip one layer of matching quotes. */
export function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

/**
 * Split an INI document into sections. Blank and comment lines are skipped; a `key=value` line
 * before any `[section]` lands in a section named "" so the validator can report it.
 * Malformed lines are kept out here and reported by `validateIni`.
 */
export function parseIni(text: string): IniValidation["sections"] {
  const sections: IniValidation["sections"] = [];
  let current: IniValidation["sections"][number] | null = null;
  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isComment(line)) return;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      const name = header[1].trim();
      current = sections.find((s) => s.name === name) ?? null;
      if (!current) {
        current = { name, keys: [] };
        sections.push(current);
      }
      return;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) return;
    if (!current) {
      current = { name: "", keys: [] };
      sections.push(current);
    }
    current.keys.push({
      key: line.slice(0, eq).trim(),
      value: line.slice(eq + 1).trim(),
      line: i + 1,
    });
  });
  return sections;
}

/* ---- value schemas ------------------------------------------------------------------- */

const boolSchema = z
  .string()
  .transform((s) => unquote(s).toLowerCase())
  .pipe(z.enum(["true", "false"]));

function intSchema(range?: [number, number]) {
  let n = z.number().int();
  if (range) n = n.min(range[0]).max(range[1]);
  return z
    .string()
    .transform((s) => unquote(s))
    .pipe(z.coerce.number())
    .pipe(n);
}

const steamIdSchema = z.string().regex(/^7656119\d{10}$/);

const ROTATION_FIELDS = ["Map", "Experience", "Experiences", "Lighting", "ZoneAlternator"];

/** Parse `(Map="…",Experience="…",Lighting="…")` into its fields, or explain why not. */
export function parseRotationEntry(
  value: string,
): { ok: true; fields: Record<string, string> } | { ok: false; reason: string } {
  const v = value.trim();
  if (!v.startsWith("(") || !v.endsWith(")"))
    return { ok: false, reason: "entry must be wrapped in parentheses" };
  const inner = v.slice(1, -1);
  const fields: Record<string, string> = {};
  const re = /\s*([A-Za-z]+)\s*=\s*"([^"]*)"\s*(?:,|$)/y;
  let pos = 0;
  while (pos < inner.length) {
    re.lastIndex = pos;
    const m = re.exec(inner);
    if (!m)
      return { ok: false, reason: `could not read the entry near "${inner.slice(pos, pos + 16)}"` };
    const [, name, val] = m;
    if (!ROTATION_FIELDS.includes(name))
      return { ok: false, reason: `unknown field ${name} (use ${ROTATION_FIELDS.join(", ")})` };
    if (name in fields) return { ok: false, reason: `${name} given twice` };
    fields[name] = val;
    pos = re.lastIndex;
  }
  if (!fields.Map) return { ok: false, reason: "Map is required" };
  if (fields.Experience !== undefined && fields.Experiences !== undefined)
    return { ok: false, reason: "use Experience (one) or Experiences (several), not both" };
  if (fields.Experience === undefined && fields.Experiences === undefined)
    return { ok: false, reason: "an Experience or Experiences field is required" };
  if (fields.Experience === "" || fields.Experiences === "")
    return { ok: false, reason: "the experience must not be empty" };
  return { ok: true, fields };
}

/* ---- validation ---------------------------------------------------------------------- */

const known = new Map<string, Map<string, (typeof INI_KEYS)[number]>>();
for (const k of INI_KEYS) {
  let m = known.get(k.section);
  if (!m) {
    m = new Map();
    known.set(k.section, m);
  }
  m.set(k.key, k);
}

function lookup(sections: IniValidation["sections"], section: string, key: string) {
  const s = sections.find((x) => x.name === section);
  if (!s) return undefined;
  const hits = s.keys.filter((k) => k.key === key);
  return hits.length ? hits[hits.length - 1] : undefined;
}

const truthy = (v: string | undefined) =>
  v === undefined ? undefined : unquote(v).toLowerCase() === "true";

export function validateIni(text: string): IniValidation {
  const issues: IniIssue[] = [];
  const stripped: string[] = [];
  const sections = parseIni(text);
  const push = (i: IniIssue) => issues.push(i);

  // Lines that are neither blank, comment, header nor key=value.
  text.split(/\r\n|\r|\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || isComment(line) || /^\[.+\]$/.test(line) || line.indexOf("=") > 0) return;
    push({
      line: i + 1,
      level: "error",
      code: "syntax",
      message: `Line ${i + 1} is not a [section] header or a key=value pair.`,
    });
  });

  for (const s of sections) {
    if (s.name === "") {
      for (const k of s.keys) {
        stripped.push(k.key);
        push({
          line: k.line,
          level: "warning",
          code: "orphan-key",
          key: k.key,
          message: `${k.key} appears before any [section]; it is ignored.`,
        });
      }
      continue;
    }
    const keys = known.get(s.name);
    if (!keys) {
      stripped.push(`[${s.name}]`);
      push({
        line: null,
        level: "warning",
        code: "unknown-section",
        message: `[${s.name}] is not a section the server reads; it and its ${s.keys.length} key${s.keys.length === 1 ? "" : "s"} are stripped.`,
      });
      continue;
    }
    const seen = new Map<string, number>();
    for (const k of s.keys) {
      const def = keys.get(k.key);
      if (!def) {
        stripped.push(`${s.name}.${k.key}`);
        push({
          line: k.line,
          level: "warning",
          code: "unknown-key",
          key: k.key,
          message: `${k.key} is not honoured in [${s.name}]; it is stripped.`,
        });
        continue;
      }
      if (def.type !== "list") {
        const prev = seen.get(k.key);
        if (prev !== undefined)
          push({
            line: k.line,
            level: "warning",
            code: "duplicate",
            key: k.key,
            message: `${k.key} is set again on line ${k.line} (first on line ${prev}); the last value wins.`,
          });
        seen.set(k.key, k.line);
      }
      checkValue(def, k, push);
    }
  }

  // Cross-key rules.
  const rconEnabled = truthy(lookup(sections, RCON, "bEnabled")?.value);
  const bind = lookup(sections, RCON, "BindAddress");
  const password = unquote(lookup(sections, RCON, "Password")?.value ?? "");
  const hash = unquote(lookup(sections, RCON, "PasswordHash")?.value ?? "");
  const bindValue = bind ? unquote(bind.value) : "127.0.0.1";
  const network =
    bindValue !== "" &&
    bindValue !== "127.0.0.1" &&
    bindValue !== "localhost" &&
    bindValue !== "::1";
  if (bind && network && password && !hash) {
    push({
      line: bind.line,
      level: "error",
      code: "network-needs-hash",
      key: "BindAddress",
      message: `A network listener (BindAddress=${bindValue}) needs PasswordHash; a plaintext Password only works on loopback. Network listener needs PasswordHash.`,
    });
  }
  if (bind && network && rconEnabled) {
    push({
      line: bind.line,
      level: "warning",
      code: "tls-required",
      key: "BindAddress",
      message: `bEnabled=true on ${bindValue}: the listener will not start without a TLS cert and key. TLS cert and key required.`,
    });
  }

  const maxPlayers = intOf(lookup(sections, "/Script/Engine.GameSession", "MaxPlayers")?.value);
  const minPlayers = lookup(
    sections,
    "MatchState.PreMatch.WaitingForPlayers.PlayerCount",
    "MinimumRequiredPlayers",
  );
  const minPlayersN = intOf(minPlayers?.value);
  if (minPlayers && minPlayersN !== null && maxPlayers !== null && minPlayersN > maxPlayers) {
    push({
      line: minPlayers.line,
      level: "warning",
      code: "min-over-max",
      key: "MinimumRequiredPlayers",
      message: `MinimumRequiredPlayers (${minPlayersN}) is above MaxPlayers (${maxPlayers}); a match can never start.`,
    });
  }
  const reserved = lookup(sections, SESSION, "MaxReservedSlots");
  const reservedN = intOf(reserved?.value);
  if (reserved && reservedN !== null && maxPlayers !== null && reservedN > maxPlayers) {
    push({
      line: reserved.line,
      level: "warning",
      code: "reserved-over-max",
      key: "MaxReservedSlots",
      message: `MaxReservedSlots (${reservedN}) is above MaxPlayers (${maxPlayers}).`,
    });
  }
  for (const [lo, hi, what] of [
    ["ServerMinPlayerCash", "ServerMaxPlayerCash", "cash"],
    ["ServerMinPlayerLevel", "ServerMaxPlayerLevel", "level"],
  ] as const) {
    const a = lookup(sections, SESSION, lo);
    const b = lookup(sections, SESSION, hi);
    const an = intOf(a?.value);
    const bn = intOf(b?.value);
    if (a && b && an !== null && bn !== null && bn !== 0 && an > bn)
      push({
        line: b.line,
        level: "warning",
        code: "min-over-max",
        key: hi,
        message: `${lo} (${an}) is above ${hi} (${bn}); nobody can join by ${what}.`,
      });
  }
  const image = lookup(sections, SESSION, "ServerImageURL");
  if (image && unquote(image.value) && !/^https?:\/\//i.test(unquote(image.value)))
    push({
      line: image.line,
      level: "warning",
      code: "url",
      key: "ServerImageURL",
      message: "ServerImageURL should be an http(s) URL to a 1024×256 PNG/JPEG on the allow-list.",
    });
  const mode = lookup(sections, ROTATION, "RotationMode");
  if (mode && !ROTATION_MODES.some((m) => m.toLowerCase() === unquote(mode.value).toLowerCase()))
    push({
      line: mode.line,
      level: "error",
      code: "enum",
      key: "RotationMode",
      message: `RotationMode must be Ordered or Random, not "${unquote(mode.value)}".`,
    });
  const rotationOn = truthy(lookup(sections, ROTATION, "bEnabled")?.value);
  const entries =
    sections.find((s) => s.name === ROTATION)?.keys.filter((k) => k.key === "+RotationEntries") ??
    [];
  if (rotationOn && entries.length === 0)
    push({
      line: null,
      level: "warning",
      code: "empty-rotation",
      key: "+RotationEntries",
      message:
        "Rotation is enabled but has no +RotationEntries; the server stays on its current map.",
    });

  const errors = issues.filter((i) => i.level === "error");
  return {
    ok: errors.length === 0,
    issues,
    sections,
    stripped,
    warnings: issues.filter((i) => i.level === "warning").map((i) => i.message),
  };
}

function intOf(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(unquote(v));
  return Number.isInteger(n) ? n : null;
}

function checkValue(
  def: (typeof INI_KEYS)[number],
  k: { key: string; value: string; line: number },
  push: (i: IniIssue) => void,
) {
  switch (def.type) {
    case "bool": {
      if (!boolSchema.safeParse(k.value).success)
        push({
          line: k.line,
          level: "error",
          code: "type",
          key: k.key,
          message: `${k.key} must be true or false, not "${k.value}".`,
        });
      return;
    }
    case "int": {
      const v = unquote(k.value);
      if (!intSchema().safeParse(v).success) {
        push({
          line: k.line,
          level: "error",
          code: "type",
          key: k.key,
          message: `${k.key} must be a whole number, not "${k.value}".`,
        });
        return;
      }
      if (def.range && !intSchema(def.range).safeParse(v).success)
        push({
          line: k.line,
          level: "error",
          code: "range",
          key: k.key,
          message: `${k.key}=${v} is outside ${def.range[0]}–${def.range[1]}.`,
        });
      return;
    }
    case "list": {
      const v = unquote(k.value);
      if (k.key === "+RotationEntries") {
        const r = parseRotationEntry(k.value);
        if (!r.ok)
          push({
            line: k.line,
            level: "error",
            code: "rotation-entry",
            key: k.key,
            message: `+RotationEntries on line ${k.line}: ${r.reason}.`,
          });
        return;
      }
      if (!steamIdSchema.safeParse(v).success)
        push({
          line: k.line,
          level: "error",
          code: "steamid",
          key: k.key,
          message: `${k.key} expects a 17-digit SteamID64 starting 7656119, not "${v}".`,
        });
      return;
    }
    default:
      return;
  }
}
