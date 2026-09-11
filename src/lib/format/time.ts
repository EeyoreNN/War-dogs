/**
 * `just now` / `12 min ago` / `3 h ago` / `2 days ago` for the Rejoin rows on `/` and `/join`
 * (§4.1, §4.5 "rows as on Home"): one formatter, so the same room never reads differently on the
 * two pages. Whole units, floored; a future timestamp reads `just now`. zod-free (§5.4).
 */
export function timeAgo(then: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
