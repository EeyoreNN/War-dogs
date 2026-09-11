// IndexedDB `wardogs` / store `maps` (§5.4): uploaded map blobs by hash. Falls back to an
// in-memory Map when indexedDB is undefined (jsdom, SSR) or fails to open.
import { IDB_NAME, IDB_STORE_MAPS } from "./keys";

export interface MapRecord {
  shared: Blob;
  full: Blob | null;
  w: number;
  h: number;
  mime: string;
  name: string;
  at: number;
}

const memory = new Map<string, MapRecord>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const idb = globalThis.indexedDB;
      if (!idb) return resolve(null);
      const req = idb.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_MAPS)) db.createObjectStore(IDB_STORE_MAPS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("idb"));
  });
}

export async function putMap(hash: string, rec: MapRecord): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory.set(hash, rec);
    return;
  }
  try {
    const tx = db.transaction(IDB_STORE_MAPS, "readwrite");
    await request(tx.objectStore(IDB_STORE_MAPS).put(rec, hash));
  } catch {
    memory.set(hash, rec);
  }
}

export async function getMap(hash: string): Promise<MapRecord | null> {
  const db = await openDb();
  if (!db) return memory.get(hash) ?? null;
  try {
    const tx = db.transaction(IDB_STORE_MAPS, "readonly");
    const rec = (await request(tx.objectStore(IDB_STORE_MAPS).get(hash))) as MapRecord | undefined;
    return rec ?? memory.get(hash) ?? null;
  } catch {
    return memory.get(hash) ?? null;
  }
}

export async function deleteMap(hash: string): Promise<void> {
  memory.delete(hash);
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE_MAPS, "readwrite");
    await request(tx.objectStore(IDB_STORE_MAPS).delete(hash));
  } catch {
    /* memory copy already gone */
  }
}

/** Test hook: forget the memory fallback and the cached db handle. */
export function resetIdb(): void {
  memory.clear();
  dbPromise = null;
}
