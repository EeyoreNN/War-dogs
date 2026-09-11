import { describe, expect, it } from "vitest";
import {
  CLIENT_ID_PATTERN,
  ID_ALPHABET,
  isClientId,
  mulberry32,
  newClientId,
  newId,
  seededIds,
} from "./ids";
import {
  codeFromInstance,
  isReservedCode,
  isRoomCode,
  newRoomCode,
  normalizeCode,
  CODE_ALPHABET,
  RESERVED_CODES,
} from "../room/code";
import { AnyRoomCodeSchema, RelayRoomSchema, RoomCodeSchema } from "../room/schema";

describe("ids", () => {
  it("newId: 16 chars from the alphabet, unique", () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id.length).toBe(16);
      for (const c of id) expect(ID_ALPHABET.includes(c)).toBe(true);
    }
  });
  it("newClientId matches the format", () => {
    const c = newClientId();
    expect(c).toMatch(CLIENT_ID_PATTERN);
    expect(isClientId(c)).toBe(true);
    expect(isClientId("wd_O0O0O0O0O0O0")).toBe(false);
    expect(isClientId("abc")).toBe(false);
  });
  it("seededIds is deterministic; mulberry32 is in [0, 1)", () => {
    const a = seededIds(42);
    const b = seededIds(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seededIds(43)()).not.toBe(seededIds(42)());
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("falls back to Math.random without crypto", () => {
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      expect(newId().length).toBe(16);
      expect(newRoomCode().length).toBe(6);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: saved,
        configurable: true,
        writable: true,
      });
    }
  });
});

describe("room codes", () => {
  it("alphabet and length; never a reserved code", () => {
    expect(CODE_ALPHABET.length).toBe(32);
    expect(CODE_ALPHABET).not.toMatch(/[0O1I]/);
    for (let i = 0; i < 100; i++) {
      const c = newRoomCode();
      expect(isRoomCode(c)).toBe(true);
      expect(isReservedCode(c)).toBe(false);
    }
  });
  it("normalizeCode and isRoomCode", () => {
    expect(normalizeCode("x5gm-4q")).toBe("X5GM4Q");
    expect(normalizeCode(" X5GM 4Q ")).toBe("X5GM4Q");
    expect(isRoomCode("X5GM4Q")).toBe(true);
    expect(isRoomCode("X5GM40")).toBe(false);
    expect(isRoomCode("X5GM4")).toBe(false);
    expect(isRoomCode("ABCDEFG")).toBe(false);
    expect(isReservedCode("DEMO")).toBe(true);
    expect(RESERVED_CODES).toEqual(["DEMO"]);
  });
  it("codeFromInstance is stable and valid", () => {
    const a = codeFromInstance("i-123456789");
    expect(a).toBe(codeFromInstance("i-123456789"));
    expect(isRoomCode(a)).toBe(true);
    expect(codeFromInstance("i-123456780")).not.toBe(a);
    expect(isRoomCode(codeFromInstance(""))).toBe(true);
  });
  it("schemas", () => {
    expect(RoomCodeSchema.parse("x5gm-4q")).toBe("X5GM4Q");
    expect(RoomCodeSchema.safeParse("DEMO").success).toBe(false);
    expect(AnyRoomCodeSchema.parse("DEMO")).toBe("DEMO");
    expect(AnyRoomCodeSchema.parse("abc234")).toBe("ABC234");
    expect(RelayRoomSchema.safeParse("DEMO-12").success).toBe(true);
    expect(RelayRoomSchema.safeParse("DEMO-").success).toBe(false);
    expect(RelayRoomSchema.safeParse("SIM").success).toBe(false);
    expect(RelayRoomSchema.parse("abc234")).toBe("ABC234");
  });
});
