import { describe, expect, it } from "vitest";
import { marker, shape, stroke, text as textNode } from "@/lib/map/test-fixtures";
import { describeNode, describeRequest, nodeKindLabel } from "./describe";
import { createRequest } from "@/lib/map/requests";
import { asClientId } from "@/lib/map/types";

describe("describe", () => {
  it("markers carry their group, label, grid ref and author", () => {
    const lz = marker("N1", {
      kind: "lz",
      label: "LZ BRAVO",
      at: { x: 0.35, y: 0.65 },
      authorName: "Boston",
    });
    expect(describeNode(lz)).toBe('Friendly LZ "LZ BRAVO" at D7, placed by Boston');
    const fob = marker("N2", {
      kind: "enemy-fob",
      team: "Valkyra",
      label: "AUSTIN",
      at: { x: 0.55, y: 0.25 },
      authorName: "Rook",
    });
    expect(describeNode(fob)).toBe('Enemy FOB · Valkyra "AUSTIN" at F3, placed by Rook');
    expect(nodeKindLabel(marker("N3", { kind: "danger" }))).toBe("Danger area");
  });
  it("shapes, text, strokes", () => {
    expect(
      describeNode(
        shape("S1", {
          shape: "arrow",
          a: { x: 0.21, y: 0.51 },
          b: { x: 0.41, y: 0.41 },
          authorName: "Ossian",
        }),
      ),
    ).toBe("Arrow from C6 to E5, drawn by Ossian");
    expect(
      describeNode(
        textNode("T1", { text: "Hold the\nridge", at: { x: 0.42, y: 0.3 }, authorName: "Ossian" }),
      ),
    ).toBe('Text "Hold the ridge" at E4, by Ossian');
    expect(describeNode(stroke("K1", { color: "blue", authorName: "Rook" }))).toMatch(
      /^Pen stroke near [A-J]\d+, blue ink, by Rook$/,
    );
  });
  it("requests", () => {
    const r = createRequest({
      id: "R1",
      kind: "fuel",
      priority: "urgent",
      by: asClientId("wd_AAAAAAAAAAA2"),
      byName: "Boston",
      at: { x: 0.35, y: 0.65 },
      note: "",
      layer: "team",
      now: 0,
    });
    expect(describeRequest(r)).toBe("Fuel · open · by Boston at D7 · urgent");
  });
});
