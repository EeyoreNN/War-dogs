import { describe, expect, it } from "vitest";
import { CallsignSchema } from "@/lib/map/schema";
import { parseCallsign } from "./callsign";

const CASES = [
  "Alpha",
  "  Alpha  ",
  "A",
  " A ",
  "ab",
  "x".repeat(24),
  "x".repeat(25),
  " " + "x".repeat(24) + " ",
  "Al" + String.fromCharCode(0) + "pha",
  "Al" + String.fromCharCode(127) + "pha",
  "Al" + String.fromCharCode(9) + "pha",
  "Al" + String.fromCharCode(10) + "pha",
  "Ærø Ω",
  "\u{1F600}".repeat(12),
  "\u{1F600}".repeat(13),
  "",
  "   ",
];

describe("parseCallsign", () => {
  it("agrees with CallsignSchema on every case", () => {
    for (const input of CASES) {
      const zod = CallsignSchema.safeParse(input);
      expect(parseCallsign(input), JSON.stringify(input)).toBe(zod.success ? zod.data : null);
    }
  });
});
