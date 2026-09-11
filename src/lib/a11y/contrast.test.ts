import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* Reads the real token values from globals.css so the assertions track the design system. */
const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("@theme inline"));
const tokens = new Map<string, string>();
for (const m of rootBlock.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g))
  tokens.set(m[1], m[2]);

function token(name: string): string {
  const v = tokens.get(name);
  if (!v) throw new Error(`token --${name} missing or not a 6-digit hex in globals.css`);
  return v;
}

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const ratio = (fg: string, bg: string) => contrast(token(fg), token(bg));

describe("colour contrast (§2.3, §7.1)", () => {
  it("computes WCAG luminance", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("body text on every surface is >= 7:1", () => {
    for (const bg of ["bg-0", "bg-1", "bg-2"])
      expect(ratio("text-0", bg)).toBeGreaterThanOrEqual(7);
  });

  it("muted text on bg-1 is >= 4.5:1", () => {
    expect(ratio("text-1", "bg-1")).toBeGreaterThanOrEqual(4.5);
  });

  it("accent-ink on accent is >= 4.5:1 and accent on bg-1 is >= 4.5:1", () => {
    expect(ratio("accent-ink", "accent")).toBeGreaterThanOrEqual(4.5);
    expect(ratio("accent", "bg-1")).toBeGreaterThanOrEqual(4.5);
  });

  it("semantic UI colours on bg-1 are >= 3:1", () => {
    for (const c of ["warn", "ok", "danger"]) expect(ratio(c, "bg-1")).toBeGreaterThanOrEqual(3);
  });

  it("small-text variants reach 4.5:1 on bg-1 and bg-2", () => {
    for (const c of ["danger-text", "req-delivered-text"]) {
      expect(ratio(c, "bg-1")).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c, "bg-2")).toBeGreaterThanOrEqual(4.5);
    }
  });
});
