// Commander map upload pipeline (§4.3.6): magic-byte sniff → bitmap → letterbox → two variants.
// The pure parts (sniff, size checks, copy) are unit-tested; `processUpload` needs a browser.
import { formatMb } from "./format";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_SHARED_BYTES = 1_572_864;
export const FULL_PX = 2048;
export const SHARED_PX = 1024;
export const MAX_NAME_CHARS = 64;

export type ImageKind = "png" | "jpeg" | "webp";

/** PNG / JPEG / WebP by magic bytes; anything else (SVG included) is null. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "webp";
  return null;
}

export type UploadError =
  | { code: "type"; message: string }
  | { code: "size"; message: string }
  | { code: "decode"; message: string }
  | { code: "too-big-shared"; message: string };

export const UPLOAD_COPY = {
  type: "That is not a PNG, JPEG or WebP image.",
  size: (bytes: number) => `Images up to 8 MB. Yours is ${formatMb(bytes)}.`,
  decode: "The image could not be decoded. Try exporting it again as PNG or JPEG.",
  tooBigShared: "Could not make a version small enough to share. Try a simpler image.",
} as const;

/** File-level checks that need no decoding. */
export function checkUpload(bytes: Uint8Array): UploadError | { kind: ImageKind } {
  const kind = sniffImage(bytes);
  if (!kind) return { code: "type", message: UPLOAD_COPY.type };
  if (bytes.length > MAX_UPLOAD_BYTES)
    return { code: "size", message: UPLOAD_COPY.size(bytes.length) };
  return { kind };
}

export const trimName = (name: string): string => name.trim().slice(0, MAX_NAME_CHARS) || "map";

export interface ProcessedUpload {
  full: Blob;
  shared: Blob;
  sharedBytes: Uint8Array;
  hash: string;
  w: number;
  h: number;
  mime: "image/jpeg";
  name: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function letterbox(bitmap: ImageBitmap, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#141311";
  ctx.fillRect(0, 0, size, size);
  const k = Math.min(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * k;
  const h = bitmap.height * k;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

/**
 * The browser half of the pipeline: letterbox to a square on a bg-0 field; `full` (2048 px,
 * PNG for PNG sources else JPEG q0.9) and `shared` (1024 px JPEG q0.8, then q0.7, q0.6 until
 * ≤ 1.5 MB); `hash` = SHA-256 of the shared bytes.
 */
export async function processUpload(file: File): Promise<ProcessedUpload | UploadError> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);
  if ("code" in checked) return checked;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: file.type }));
  } catch {
    return { code: "decode", message: UPLOAD_COPY.decode };
  }
  try {
    const fullCanvas = letterbox(bitmap, FULL_PX);
    const full =
      checked.kind === "png"
        ? await encode(fullCanvas, "image/png")
        : await encode(fullCanvas, "image/jpeg", 0.9);
    const sharedCanvas = letterbox(bitmap, SHARED_PX);
    let shared: Blob | null = null;
    for (const q of [0.8, 0.7, 0.6]) {
      const candidate = await encode(sharedCanvas, "image/jpeg", q);
      if (candidate.size <= MAX_SHARED_BYTES) {
        shared = candidate;
        break;
      }
    }
    if (!shared) return { code: "too-big-shared", message: UPLOAD_COPY.tooBigShared };
    const sharedBytes = new Uint8Array(await shared.arrayBuffer());
    return {
      full,
      shared,
      sharedBytes,
      hash: await sha256Hex(sharedBytes),
      w: SHARED_PX,
      h: SHARED_PX,
      mime: "image/jpeg",
      name: trimName(file.name),
    };
  } finally {
    bitmap.close();
  }
}
