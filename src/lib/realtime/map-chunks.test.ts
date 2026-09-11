import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, chunkMap, createMapAssembler, MAP_CHUNK_BYTES, sha256Hex } from "./map-chunks";
import { parseWire } from "./schema";

describe("map chunks", () => {
  it("base64 round-trips and chunks are 48 kB of bytes", async () => {
    const bytes = new Uint8Array(MAP_CHUNK_BYTES * 2 + 100);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 255;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    const hash = await sha256Hex(bytes);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const chunks = chunkMap(bytes, { hash, mime: "image/jpeg", w: 1024, h: 1024 }, "ABC234");
    expect(chunks.length).toBe(3);
    expect(chunks[0].n).toBe(3);
    for (const c of chunks) {
      const frame = JSON.stringify(c);
      expect(parseWire(frame, frame.length)).not.toBeNull();
    }
    expect(chunkMap(new Uint8Array(0), { hash, mime: "image/jpeg", w: 1, h: 1 }, "R").length).toBe(1);
  });
  it("assembles out of order, verifies the hash, and reports mismatches", async () => {
    const bytes = new Uint8Array(MAP_CHUNK_BYTES + 10).fill(7);
    const hash = await sha256Hex(bytes);
    const chunks = chunkMap(bytes, { hash, mime: "image/jpeg", w: 1024, h: 1024 }, "R");
    const asm = createMapAssembler();
    expect(await asm.push(chunks[1])).toEqual({ status: "partial" });
    expect(await asm.push(chunks[1])).toEqual({ status: "partial" });
    const done = await asm.push(chunks[0]);
    expect(done.status).toBe("complete");
    if (done.status === "complete") expect(done.map.bytes).toEqual(bytes);
    expect(asm.size).toBe(0);
    const wrong = chunkMap(bytes, { hash: "a".repeat(64), mime: "image/jpeg", w: 1024, h: 1024 }, "R");
    await asm.push(wrong[0]);
    expect(await asm.push(wrong[1])).toEqual({ status: "mismatch", hash: "a".repeat(64) });
    expect(await asm.push({ ...chunks[0], i: 9 })).toEqual({ status: "rejected" });
    expect(await asm.push({ ...chunks[0], n: 1, data: "@@@" })).toEqual({ status: "rejected" });
  });
});
