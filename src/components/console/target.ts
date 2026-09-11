/** `sessionStorage wardogs:console:target` (§5.4): never localStorage — the token stays with this tab. */

export const TARGET_KEY = "wardogs:console:target";

export type TargetMode = "sim" | "server";
export interface ConsoleTarget {
  mode: TargetMode;
  baseUrl: string;
  token: string;
}

export const DEFAULT_TARGET: ConsoleTarget = { mode: "sim", baseUrl: "", token: "" };

export function loadTarget(): ConsoleTarget {
  try {
    const raw = sessionStorage.getItem(TARGET_KEY);
    if (!raw) return DEFAULT_TARGET;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return DEFAULT_TARGET;
    const o = v as Partial<ConsoleTarget>;
    return {
      mode: o.mode === "server" ? "server" : "sim",
      baseUrl: typeof o.baseUrl === "string" ? o.baseUrl : "",
      token: typeof o.token === "string" ? o.token : "",
    };
  } catch {
    return DEFAULT_TARGET;
  }
}

export function saveTarget(t: ConsoleTarget): void {
  cached = t;
  try {
    sessionStorage.setItem(TARGET_KEY, JSON.stringify(t));
  } catch {
    /* private mode or quota: keep it in memory */
  }
  listeners.forEach((l) => l());
}

/* A tiny external store so `useSyncExternalStore` gets a stable snapshot between writes. */
let cached: ConsoleTarget | null = null;
const listeners = new Set<() => void>();

export function getTargetSnapshot(): ConsoleTarget {
  if (!cached) cached = loadTarget();
  return cached;
}

export function subscribeTarget(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Test hook: forget the cached snapshot. */
export function resetTargetCache(): void {
  cached = null;
}

/** A plaintext listener cannot be called from an HTTPS page (mixed content). */
export function mixedContent(baseUrl: string, pageProtocol: string): boolean {
  return pageProtocol === "https:" && /^http:\/\//i.test(baseUrl.trim());
}

export function normaliseBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}
