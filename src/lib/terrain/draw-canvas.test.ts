import { afterEach, describe, expect, it, vi } from "vitest";
import { clearBitmapCache, drawTerrain, terrainBitmap, type Ctx2D } from "./draw-canvas";
import { mapModel } from "./generate";

/** A recording 2D context: enough surface for drawTerrain, no rasteriser. */
function fakeCtx(size: number) {
  const calls: string[] = [];
  const rec =
    (name: string) =>
    (..._args: unknown[]) => {
      calls.push(name);
    };
  const ctx = {
    calls,
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    save: rec("save"),
    restore: rec("restore"),
    setTransform: rec("setTransform"),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: rec("putImageData"),
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    arc: rec("arc"),
    rect: rec("rect"),
    quadraticCurveTo: rec("quadraticCurveTo"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    setLineDash: rec("setLineDash"),
    translate: rec("translate"),
    rotate: rec("rotate"),
    fillRect: rec("fillRect"),
    fillText: rec("fillText"),
    strokeText: rec("strokeText"),
    createPattern: () => null,
    createRadialGradient: () => ({ addColorStop: rec("addColorStop") }),
  };
  void size;
  return ctx;
}

describe("drawTerrain", () => {
  it("paints ground, vectors, glyphs and labels in order", () => {
    const ctx = fakeCtx(256);
    drawTerrain(ctx as unknown as Ctx2D, mapModel("ozeti"), 256);
    const c = ctx.calls;
    expect(c[0]).toBe("save");
    expect(c.indexOf("putImageData")).toBeLessThan(c.indexOf("stroke"));
    expect(c.filter((n) => n === "stroke").length).toBeGreaterThan(10);
    expect(c.filter((n) => n === "fillText").length).toBeGreaterThan(5);
    expect(c.indexOf("fillRect")).toBeLessThan(c.indexOf("fillText"));
    expect(c[c.length - 1]).toBe("restore");
  });
  it("skips labels on tiny sizes", () => {
    const ctx = fakeCtx(160);
    drawTerrain(ctx as unknown as Ctx2D, mapModel("bakurani"), 160);
    expect(ctx.calls).not.toContain("fillText");
  });
});

describe("terrainBitmap", () => {
  afterEach(() => {
    clearBitmapCache();
    vi.unstubAllGlobals();
  });
  it("draws once per (map, size) and memoises the promise", async () => {
    const bitmap = { width: 64, height: 64 } as ImageBitmap;
    const getContext = vi.fn(() => fakeCtx(64));
    class FakeOffscreen {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext = getContext;
    }
    vi.stubGlobal("OffscreenCanvas", FakeOffscreen);
    const create = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", create);
    const model = mapModel("zestafona");
    const a = terrainBitmap(model, 64);
    const b = terrainBitmap(model, 64);
    expect(a).toBe(b);
    expect(await a).toBe(bitmap);
    expect(create).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalled();
    await terrainBitmap(model, 128);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("rejects and forgets when no 2d context is available", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    const canvas = { getContext: () => null, width: 0, height: 0 };
    vi.stubGlobal("document", { createElement: () => canvas });
    await expect(terrainBitmap(mapModel("zestafona"), 32)).rejects.toThrow(/no 2d context/);
  });
});
