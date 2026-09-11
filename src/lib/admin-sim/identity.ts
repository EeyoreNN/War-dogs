/**
 * The dashboard's view of the visitor (§5.4): the war-room callsign from `wardogs:identity`
 * (WP1's `@/lib/storage`, which mints the client id and guards the shape) and one preference,
 * `wardogs:prefs.showRcon`. Two things WP1 leaves to the caller: an identity may carry an empty
 * callsign until the visitor types one (the dashboard needs a name for the audit, so it fills in
 * `Operator XXXX` and saves it), and the sheet opens automatically until the visitor unticks
 * "Don't show automatically" (§4.8) — so `showRcon` defaults to true when the pref is absent.
 */

// Submodule imports on purpose: the `@/lib/storage` barrel re-exports `./room`, which reaches
// `zod` through `map/schema` — that would put ~87 kB gz on every admin first load (§7.3).
import { generateCallsign, loadIdentity, saveIdentity } from "@/lib/storage/identity";
import { KEY_PREFS } from "@/lib/storage/keys";
import { readJson } from "@/lib/storage/local";
import { savePrefs } from "@/lib/storage/prefs";

export { generateCallsign };

export interface VisitorIdentity {
  callsign: string;
}

const CALLSIGN_MAX = 24;

export function normaliseCallsign(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, CALLSIGN_MAX);
}

/** Read the identity; give it a generated callsign (and save) when it has none yet. */
export function loadVisitor(): VisitorIdentity {
  const id = loadIdentity();
  const callsign = normaliseCallsign(id.callsign);
  if (callsign) return { callsign };
  const fresh = generateCallsign();
  saveIdentity({ ...id, callsign: fresh });
  return { callsign: fresh };
}

/** Save a new callsign back to the identity, keeping every other field WP1 stores. */
export function saveCallsign(callsign: string): VisitorIdentity {
  const cur = loadVisitor();
  const next = normaliseCallsign(callsign) || cur.callsign;
  if (next !== cur.callsign) saveIdentity({ ...loadIdentity(), callsign: next });
  return { callsign: next };
}

/** `wardogs:prefs.showRcon` — open the "What this sends" sheet after every action (default true). */
export function loadShowRcon(): boolean {
  const p = readJson<{ showRcon?: unknown }>(KEY_PREFS);
  return typeof p?.showRcon === "boolean" ? p.showRcon : true;
}

export function saveShowRcon(value: boolean): void {
  savePrefs({ showRcon: value });
}
