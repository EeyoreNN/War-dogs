// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import {
  OG_CONTENT_TYPE,
  OG_PRESETS,
  OG_SIZE,
  headlineSize,
  loadOgFonts,
  ogElement,
  renderOg,
} from "./render";

/** Every string leaf in a React element tree. */
function textOf(node: ReactNode): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return textOf(props.children);
  }
  return [];
}

describe("OG presets", () => {
  it("are 1200×630 PNG cards with ≤ 3 headline lines and alt text", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
    expect(OG_CONTENT_TYPE).toBe("image/png");
    for (const preset of Object.values(OG_PRESETS)) {
      expect(preset.headline.length).toBeGreaterThanOrEqual(1);
      expect(preset.headline.length).toBeLessThanOrEqual(3);
      expect(preset.alt.length).toBeGreaterThan(10);
    }
    expect(OG_PRESETS.demo.terrain).toBe("zestafona");
    expect(OG_PRESETS.admin.terrain).toBe("bakurani");
    expect(OG_PRESETS.room.terrain).toBe("ozeti");
    expect(OG_PRESETS.root.terrain).toBeNull();
  });
});

describe("headlineSize", () => {
  it("caps at 128 px and shrinks long lines to fit", () => {
    expect(headlineSize(["THE LIVE DEMO"])).toBe(128);
    expect(headlineSize(["IN THE SAME DISCORD"])).toBeLessThan(128);
    expect(headlineSize([])).toBe(128);
  });
});

describe("loadOgFonts", () => {
  it("reads the two committed TTFs", () => {
    const fonts = loadOgFonts();
    expect(fonts).not.toBeNull();
    expect(fonts?.map((f) => f.name)).toEqual(["Saira Condensed", "Barlow"]);
    expect(fonts?.every((f) => f.data.byteLength > 50_000)).toBe(true);
    expect(loadOgFonts()).toBe(fonts);
  });
});

describe("ogElement", () => {
  it("renders the lockup, headline and strapline with fonts, and never the room code", () => {
    const text = textOf(ogElement(OG_PRESETS.root, loadOgFonts()));
    expect(text).toContain("THE TACTICAL MAP");
    expect(text).toContain("SERVER NEEDS");
    expect(text).toContain("DRAW THE PLAN. CALL THE DROP. EVERYONE SEES IT.");
    expect(text).toContain("WARDOGS");
    expect(text).toContain(".TECH");
    const room = textOf(ogElement(OG_PRESETS.room, loadOgFonts())).join(" ");
    expect(room).toContain("JOIN THE WAR ROOM");
    expect(room).not.toMatch(/[A-Z0-9]{6}\b(?![ .])/);
  });
  it("falls back to a text-free composition without fonts", () => {
    const el = ogElement(OG_PRESETS.demo, null);
    expect(textOf(el)).toEqual([]);
  });
  it("embeds a label-free terrain crop only for presets with a map", () => {
    const withMap = JSON.stringify(ogElement(OG_PRESETS.demo, null));
    expect(withMap).toContain("data:image/svg+xml");
    expect(withMap).not.toContain("HOUSES");
    expect(JSON.stringify(ogElement(OG_PRESETS.dev, null))).not.toContain(
      "data:image/svg+xml;charset=utf-8",
    );
  });
});

describe("renderOg", () => {
  it("returns a PNG response", async () => {
    const res = renderOg(OG_PRESETS.dev);
    expect(res.headers.get("content-type")).toContain("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 30_000);
});
