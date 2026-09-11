import { describe, expect, it } from "vitest";
import { hashLattice, hashString, mulberry32 } from "./rng";

describe("hashString", () => {
  it("is FNV-1a 32-bit, unsigned", () => {
    expect(hashString("")).toBe(0x811c9dc5);
    expect(hashString("a")).toBe(0xe40c292c);
    expect(hashString("wardogs")).toBeGreaterThanOrEqual(0);
    expect(hashString("wardogs")).not.toBe(hashString("wardogz"));
  });
});

describe("mulberry32", () => {
  it("is deterministic per seed and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seq = Array.from({ length: 50 }, () => a());
    expect(seq).toEqual(Array.from({ length: 50 }, () => b()));
    for (const v of seq) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
});

describe("hashLattice", () => {
  it("is stable and unsigned", () => {
    expect(hashLattice(1, 2, 3)).toBe(hashLattice(1, 2, 3));
    expect(hashLattice(1, 2, 3)).not.toBe(hashLattice(1, 3, 2));
    expect(hashLattice(7, -5, 9)).toBeGreaterThanOrEqual(0);
  });
});
