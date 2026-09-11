// Pure functions of window.location (§4.7): no SDK import, safe in every bundle.

/** Discord opens the Activity as `https://<clientId>.discordsays.com/?frame_id=…`. */
export function isInsideDiscord(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const { search, hostname } = window.location;
    if (new URLSearchParams(search).has("frame_id")) return true;
    return hostname.endsWith("discordsays.com");
  } catch {
    return false;
  }
}

/** `wss://<host>/relay` — through the Activity's /relay URL mapping (Discord's CSP allows only that host). */
export function activityRelayUrl(): string {
  const host = typeof window === "undefined" ? "" : window.location.host;
  return `wss://${host}/relay`;
}
