// Guarded localStorage access (§5.4): every read/write is wrapped; a failure degrades to memory
// and notifies `onStorageError` once so the store can flip `storageOk` and toast.

export type StorageFailure = "unavailable" | "quota" | "error";

type Listener = (failure: StorageFailure) => void;
const listeners = new Set<Listener>();
let failed: StorageFailure | null = null;

/** Subscribe to the first storage failure (and any later one). */
export function onStorageError(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function storageFailure(): StorageFailure | null {
  return failed;
}

/** Test hook: forget a previous failure. */
export function resetStorageFailure(): void {
  failed = null;
}

function report(f: StorageFailure): void {
  failed = f;
  for (const l of listeners) l(f);
}

function isQuota(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { name?: string; code?: number };
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  );
}

function area(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readLocal(key: string): string | null {
  try {
    const s = area();
    return s ? s.getItem(key) : null;
  } catch {
    report("error");
    return null;
  }
}

/** true when written; false when storage is unavailable or full (reported). */
export function writeLocal(key: string, value: string): boolean {
  const s = area();
  if (!s) {
    report("unavailable");
    return false;
  }
  try {
    s.setItem(key, value);
    return true;
  } catch (e) {
    report(isQuota(e) ? "quota" : "error");
    return false;
  }
}

export function removeLocal(key: string): void {
  try {
    area()?.removeItem(key);
  } catch {
    /* nothing to clean */
  }
}

export function readJson<T = unknown>(key: string): T | null {
  const raw = readLocal(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  return writeLocal(key, JSON.stringify(value));
}

/** Every localStorage key (for cleanup routines); [] when unavailable. */
export function localKeys(): string[] {
  try {
    const s = area();
    if (!s) return [];
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}
