// `wardogs:relay` (§5.2, §5.4): an optional same-origin override for self-hosters and e2e.
// "off" forces LOCAL; any ws(s):// URL is used. Never written by the app itself.
import { KEY_RELAY } from "./keys";
import { readLocal } from "./local";

export type RelayOverride = "off" | string;

const WS_URL = /^wss?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i;

export function loadRelayOverride(): RelayOverride | null {
  const raw = readLocal(KEY_RELAY);
  if (raw === null) return null;
  const v = raw.trim().replace(/^"|"$/g, "");
  if (v === "off") return "off";
  return WS_URL.test(v) ? v : null;
}
