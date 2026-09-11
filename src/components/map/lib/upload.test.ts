import { describe, expect, it } from "vitest";
import { checkUpload, MAX_UPLOAD_BYTES, sniffImage, trimName, UPLOAD_COPY } from "./upload";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("upload checks", () => {
  it("sniffs by magic bytes, never by extension", () => {
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(jpeg)).toBe("jpeg");
    expect(sniffImage(webp)).toBe("webp");
    expect(sniffImage(svg)).toBeNull();
    expect(sniffImage(new Uint8Array(3))).toBeNull();
  });
  it("rejects the wrong type and oversize files with the spec copy", () => {
    expect(checkUpload(svg)).toEqual({ code: "type", message: UPLOAD_COPY.type });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(jpeg);
    const r = checkUpload(big);
    expect(r).toMatchObject({ code: "size" });
    expect((r as { message: string }).message).toBe("Images up to 8 MB. Yours is 8.0 MB.");
    expect(checkUpload(png)).toEqual({ kind: "png" });
  });
  it("trims names to 64 chars", () => {
    expect(trimName("  " + "a".repeat(80))).toHaveLength(64);
    expect(trimName("   ")).toBe("map");
  });
});
