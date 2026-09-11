import { describe, expect, it } from "vitest";
import { MARK_CHEVRON, MARK_TICKS, markSvg } from "./mark";

const colours = {
  plate: "#1e1c18",
  plateStroke: "#4a453c",
  stroke: "#f1ebdd",
  accent: "#ffa028",
  core: "#141311",
};

describe("markSvg", () => {
  it("returns an SVG document containing the chevron path", () => {
    const svg = markSvg({ size: 64, ...colours, ticks: "#6f685d" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain(`d="${MARK_CHEVRON}"`);
    expect(svg).toContain('width="64"');
    expect(svg.match(/<rect /g)).toHaveLength(1 + MARK_TICKS.length);
  });

  it("drops the ticks and widens the chevron for the favicon variant", () => {
    const svg = markSvg({ size: 32, ...colours, ticks: null, chevronWidth: 7 });
    expect(svg.match(/<rect /g)).toHaveLength(1);
    expect(svg).toContain('stroke-width="7"');
  });
});
