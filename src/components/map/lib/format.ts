// Small formatting helpers for the app chrome (pure, unit-tested).

/** `1,240 m` for built-in maps, `0.52 map` for uploads without a scale. */
export function formatDistance(mapFraction: number, widthMetres: number | null): string {
  if (widthMetres === null) return `${mapFraction.toFixed(2)} map`;
  return `${Math.round(mapFraction * widthMetres).toLocaleString("en-US")} m`;
}

/** Three-digit compass bearing with the degree sign: `047°`. */
export function formatBearing(deg: number): string {
  const d = ((Math.round(deg) % 360) + 360) % 360;
  return `${String(d).padStart(3, "0")}°`;
}

/** `1,240 m · 047°` — the measure tool's live label. */
export function measureLabel(
  mapFraction: number,
  bearing: number,
  widthMetres: number | null,
): string {
  return `${formatDistance(mapFraction, widthMetres)} · ${formatBearing(bearing)}`;
}

/** `m:ss`, never negative. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Request age as `0:42` / `12:05` / `1:02:11` (tabular, ticking). */
export function formatAgeClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** `ETA 0:42` or `ETA −0:12` once overdue. */
export function formatEta(secondsLeft: number): string {
  const late = secondsLeft < 0;
  return `ETA ${late ? "−" : ""}${formatClock(Math.abs(secondsLeft))}`;
}

/** Spoken ETA for announcements: `1 minute`, `30 seconds`, `2 minutes`. */
export function spokenEta(etaSec: number): string {
  if (etaSec < 60) return `${etaSec} seconds`;
  const m = Math.round(etaSec / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** `11.2 MB` with one decimal. */
export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `14:32:05` local time, for the age timer tooltip. */
export function formatAbsoluteTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** `wardogs-X5GM4Q-20260911-1432` — the export file stem (local time). */
export function exportStem(code: string, now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `wardogs-${code}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** `12 min ago` / `2 days ago` / `just now` for the recent-rooms list. */
export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** First letter for the collapsed avatar in the top bar. */
export function initialOf(callsign: string): string {
  const t = callsign.trim();
  return t ? t[0].toUpperCase() : "?";
}
