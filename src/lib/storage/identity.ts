// `wardogs:identity` (§5.4): { v:1, client, callsign, focus, ink }. Hand-written guard, no zod —
// the home page imports this module (§7.3). The client id is minted once and never changes.
import { newClientId } from "../map/ids";
import {
  FOCUSES,
  INK_COLORS,
  asClientId,
  type Focus,
  type Identity,
  type InkColor,
} from "../map/types";
import { KEY_IDENTITY } from "./keys";
import { readJson, writeJson } from "./local";

interface StoredIdentity {
  v: 1;
  client: string;
  callsign: string;
  focus: Focus | null;
  ink: InkColor;
}

const CLIENT_PATTERN = /^wd_[A-HJ-NP-Z2-9]{12}$/;
const isFocus = (v: unknown): v is Focus =>
  typeof v === "string" && (FOCUSES as readonly string[]).includes(v);
const isInk = (v: unknown): v is InkColor =>
  typeof v === "string" && (INK_COLORS as readonly string[]).includes(v);

function guard(raw: unknown): StoredIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || typeof o.client !== "string" || !CLIENT_PATTERN.test(o.client)) return null;
  return {
    v: 1,
    client: o.client,
    callsign: typeof o.callsign === "string" ? o.callsign.slice(0, 24) : "",
    focus: isFocus(o.focus) ? o.focus : null,
    ink: isInk(o.ink) ? o.ink : "blue",
  };
}

let cached: Identity | null = null;

/** Loads (or mints and saves) the per-browser identity. The callsign may be empty. */
export function loadIdentity(): Identity {
  if (cached) return cached;
  const stored = guard(readJson(KEY_IDENTITY));
  if (stored) {
    cached = {
      client: asClientId(stored.client),
      callsign: stored.callsign,
      focus: stored.focus,
      ink: stored.ink,
    };
    return cached;
  }
  const fresh: Identity = { client: newClientId(), callsign: "", focus: null, ink: "blue" };
  saveIdentity(fresh);
  return fresh;
}

export function saveIdentity(identity: Identity): boolean {
  cached = { ...identity };
  const stored: StoredIdentity = {
    v: 1,
    client: identity.client,
    callsign: identity.callsign,
    focus: identity.focus,
    ink: identity.ink,
  };
  return writeJson(KEY_IDENTITY, stored);
}

/** Test hook. */
export function resetIdentityCache(): void {
  cached = null;
}

const CALLSIGN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** `Operator 41E3` — the placeholder / dice-button callsign. */
export function generateCallsign(): string {
  let tail = "";
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint8Array(4);
    c.getRandomValues(buf);
    for (let i = 0; i < 4; i++) tail += CALLSIGN_CHARS[buf[i] & 31];
  } else {
    for (let i = 0; i < 4; i++) tail += CALLSIGN_CHARS[Math.floor(Math.random() * 32)];
  }
  return `Operator ${tail}`;
}
