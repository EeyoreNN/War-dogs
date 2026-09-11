import { describe, expect, it } from "vitest";
import { MAP_LIST } from "@/config/maps";
import { biomePalette, contoursFor, levelTint, terrainToDataUri, terrainToSvg } from "./draw-svg";
import { mapModel } from "./generate";
import { CONTROL_ZONE_LABEL } from "./types";

const bytes = (s: string) => Buffer.byteLength(s, "utf8");

describe("terrainToSvg", () => {
  for (const def of MAP_LIST) {
    const model = mapModel(def.id);
    it(`${def.name}: thumb ≤ 40 kB, full/1024 ≤ 150 kB, starts with <svg`, () => {
      const thumb = terrainToSvg(model, { size: 320 });
      const full = terrainToSvg(model, {
        size: 1024,
        detail: "full",
        grid: true,
        labels: true,
        zone: "default",
      });
      expect(thumb.startsWith("<svg")).toBe(true);
      expect(full.startsWith("<svg")).toBe(true);
      expect(full.endsWith("</svg>")).toBe(true);
      expect(bytes(thumb)).toBeLessThanOrEqual(40 * 1024);
      expect(bytes(full)).toBeLessThanOrEqual(150 * 1024);
      expect(bytes(terrainToSvg(model, { size: 640 }))).toBeLessThanOrEqual(150 * 1024);
      expect(thumb).toContain('viewBox="0 0 320 320"');
      expect(full).toContain('viewBox="0 0 1024 1024"');
    });
  }

  const model = mapModel("zestafona");

  it("draws the zone chip with the zone name, and none for `none`", () => {
    for (const zone of ["default", "small-factory", "water-treatment", "houses"] as const) {
      expect(terrainToSvg(model, { size: 640, zone })).toContain(
        CONTROL_ZONE_LABEL[zone].toUpperCase(),
      );
    }
    const none = terrainToSvg(model, { size: 320, zone: "none" });
    expect(none).not.toContain('stroke-dasharray="1.9 1.3"');
    expect(none).not.toContain("SMALL FACTORY");
  });

  it("honours labels, grid, detail and background options", () => {
    const withLabels = terrainToSvg(model, { size: 1024 });
    expect(withLabels).toContain("HOUSES");
    expect(withLabels).toContain("<pattern");
    const noLabels = terrainToSvg(model, { size: 1024, labels: false });
    expect(noLabels).not.toContain("HOUSES");
    const thumb = terrainToSvg(model, { size: 1024, detail: "thumb" });
    expect(thumb).not.toContain("HOUSES");
    expect(thumb).not.toContain("<pattern");
    expect(terrainToSvg(model, { size: 200, detail: "full" })).not.toContain("HOUSES");
    const grid = terrainToSvg(model, { size: 640, grid: true });
    expect(grid).toContain(">A<");
    expect(grid).toContain(">10<");
    expect(terrainToSvg(model, { size: 640 })).not.toContain(">A<");
    expect(terrainToSvg(model, { size: 640, background: false })).not.toContain(
      '<rect width="640" height="640" fill="#',
    );
    const crop = terrainToSvg(model, { size: 630, crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.25 } });
    expect(crop).toContain('viewBox="157.5 157.5 315 157.5"');
    expect(crop).toContain('height="315"');
  });

  it("escapes names and never repeats a label", () => {
    const svg = terrainToSvg(mapModel("bakurani"), { size: 1024 });
    expect(svg).toContain("SHEPHERD'S REST");
    expect(svg.split("SHEPHERD'S REST").length).toBe(2);
    expect(svg.split(">DEFAULT<").length).toBe(2);
  });

  it("uses thumb contours from a res-64 downsample", () => {
    const full = contoursFor(model, "full");
    const thumb = contoursFor(model, "thumb");
    expect(full).toBe(model.contours);
    expect(thumb.reduce((n, c) => n + c.path.length, 0)).toBeLessThan(
      full.reduce((n, c) => n + c.path.length, 0),
    );
  });

  it("tints bands from low to high", () => {
    const p = biomePalette("highland");
    expect(levelTint(p, 0.05)).toBe(p.low);
    expect(levelTint(p, 0.95)).toBe(p.high);
  });

  it("terrainToDataUri wraps the encoded svg", () => {
    const uri = terrainToDataUri(model, { size: 320 });
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg")).toBe(true);
    expect(decodeURIComponent(uri.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(
      terrainToSvg(model, { size: 320 }),
    );
  });
});
