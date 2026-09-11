// Uploaded maps over the wire (§5.7): 48 kB base64 chunks of the shared JPEG, assembled by hash
// and verified with SHA-256 before anything is stored.
import type { EphemeralMessage } from "./transport";

export const MAP_CHUNK_BYTES = 49_152;
/** Assembled maps larger than this are refused (the shared variant is ≤ 1.5 MB by construction). */
export const MAX_MAP_BYTES = 1_572_864;

export type MapChunk = Extract<EphemeralMessage, { k: "map.chunk" }>;
export interface MapMeta {
  hash: string;
  mime: string;
  w: number;
  h: number;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The map.chunk frames for `bytes` (n = ceil(len / 48 kB), at least one). */
export function chunkMap(bytes: Uint8Array, meta: MapMeta, room: string): MapChunk[] {
  const n = Math.max(1, Math.ceil(bytes.length / MAP_CHUNK_BYTES));
  const out: MapChunk[] = [];
  for (let i = 0; i < n; i++) {
    const slice = bytes.subarray(i * MAP_CHUNK_BYTES, (i + 1) * MAP_CHUNK_BYTES);
    out.push({ k: "map.chunk", room, hash: meta.hash, i, n, mime: meta.mime, w: meta.w, h: meta.h, data: bytesToBase64(slice) });
  }
  return out;
}

export interface AssembledMap extends MapMeta {
  bytes: Uint8Array;
}

export type AssembleResult = { status: "partial" } | { status: "complete"; map: AssembledMap } | { status: "mismatch"; hash: string } | { status: "rejected" };

/** Collects chunks per hash; `push` resolves once the last chunk lands and the hash verifies. */
export function createMapAssembler() {
  const pending = new Map<string, { parts: (Uint8Array | undefined)[]; n: number; meta: MapMeta; bytes: number; filled: number }>();
  return {
    async push(chunk: MapChunk): Promise<AssembleResult> {
      if (chunk.i >= chunk.n) return { status: "rejected" };
      let entry = pending.get(chunk.hash);
      if (!entry || entry.n !== chunk.n) {
        entry = { parts: new Array<Uint8Array | undefined>(chunk.n).fill(undefined), n: chunk.n, meta: { hash: chunk.hash, mime: chunk.mime, w: chunk.w, h: chunk.h }, bytes: 0, filled: 0 };
        pending.set(chunk.hash, entry);
      }
      if (entry.parts[chunk.i]) return { status: "partial" };
      let bytes: Uint8Array;
      try {
        bytes = base64ToBytes(chunk.data);
      } catch {
        return { status: "rejected" };
      }
      entry.bytes += bytes.length;
      if (entry.bytes > MAX_MAP_BYTES) {
        pending.delete(chunk.hash);
        return { status: "rejected" };
      }
      entry.parts[chunk.i] = bytes;
      entry.filled++;
      if (entry.filled < entry.n) return { status: "partial" };
      pending.delete(chunk.hash);
      const all = new Uint8Array(entry.bytes);
      let offset = 0;
      for (const p of entry.parts as Uint8Array[]) {
        all.set(p, offset);
        offset += p.length;
      }
      const hash = await sha256Hex(all);
      if (hash !== chunk.hash) return { status: "mismatch", hash: chunk.hash };
      return { status: "complete", map: { ...entry.meta, bytes: all } };
    },
    forget(hash: string) {
      pending.delete(hash);
    },
    get size() {
      return pending.size;
    },
  };
}
