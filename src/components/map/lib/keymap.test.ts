import { describe, expect, it } from "vitest";
import { isTypingTarget, KEYMAP, markerForDigit, toolForKey } from "./keymap";

describe("keymap", () => {
  it("renders every Appendix A row with keys, action and context", () => {
    expect(KEYMAP.length).toBeGreaterThanOrEqual(17);
    for (const row of KEYMAP) {
      expect(row.keys.length).toBeGreaterThan(0);
      expect(row.action).not.toBe("");
      expect(row.context).not.toBe("");
    }
    expect(KEYMAP.some((r) => r.keys.includes("N") && r.action === "new request")).toBe(true);
  });
  it("maps digits to markers in palette order", () => {
    expect(markerForDigit("1")).toBe("fob");
    expect(markerForDigit("6")).toBe("enemy-troops");
    expect(markerForDigit("8")).toBe("pin");
    expect(markerForDigit("9")).toBeNull();
  });
  it("maps letters to tools", () => {
    expect(toolForKey("v")).toBe("select");
    expect(toolForKey("P")).toBe("pen");
    expect(toolForKey("r")).toBe("rect");
    expect(toolForKey("x")).toBeNull();
  });
  it("detects typing targets", () => {
    const input = document.createElement("input");
    expect(isTypingTarget(input)).toBe(true);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isTypingTarget(checkbox)).toBe(false);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
