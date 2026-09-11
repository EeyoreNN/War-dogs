import { expect, test } from "@playwright/test";

/**
 * §6.2: every OG route answers 200 `image/png`; §3.7: the terrain route is immutable-cached
 * SVG within budget and 404s on anything it does not recognise.
 */
const OG_ROUTES = [
  "/opengraph-image",
  "/twitter-image",
  "/demo/opengraph-image",
  "/dev/opengraph-image",
  "/demo/admin/opengraph-image",
  "/room/ABC123/opengraph-image",
  "/create/opengraph-image",
  "/join/opengraph-image",
];

test.describe("OG images", () => {
  for (const route of OG_ROUTES) {
    test(`${route} is a 1200×630 PNG`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status(), route).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const body = await res.body();
      // PNG signature and IHDR dimensions.
      expect(body.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(body.readUInt32BE(16)).toBe(1200);
      expect(body.readUInt32BE(20)).toBe(630);
    });
  }

  test("the room OG never contains the code", async ({ request }) => {
    // The PNG cannot be text-searched; the guarantee is that the route ignores the code entirely,
    // so two codes render byte-identical images.
    const a = await (await request.get("/room/ABC123/opengraph-image")).body();
    const b = await (await request.get("/room/ZZZ999/opengraph-image")).body();
    expect(a.equals(b)).toBe(true);
  });
});

test.describe("/terrain route", () => {
  for (const map of ["zestafona", "bakurani", "ozeti"]) {
    test(`${map}.svg is cached SVG within budget`, async ({ request }) => {
      const full = await request.get(
        `/terrain/${map}.svg?size=1024&zone=default&grid=1&labels=1&v=test`,
      );
      expect(full.status()).toBe(200);
      expect(full.headers()["content-type"]).toContain("image/svg+xml");
      expect(full.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
      const svg = await full.text();
      expect(svg.startsWith("<svg")).toBe(true);
      expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(150 * 1024);
      expect(svg).toContain("DEFAULT");
      const thumb = await request.get(`/terrain/${map}.svg?size=320`);
      expect(thumb.status()).toBe(200);
      expect(Buffer.byteLength(await thumb.text())).toBeLessThanOrEqual(40 * 1024);
    });
  }

  test("rejects unknown files and bad queries with 404", async ({ request }) => {
    for (const bad of [
      "/terrain/atlantis.svg",
      "/terrain/ozeti.png",
      "/terrain/ozeti.svg?size=999",
      "/terrain/ozeti.svg?zone=moon",
      "/terrain/ozeti.svg?grid=2",
    ]) {
      expect((await request.get(bad)).status(), bad).toBe(404);
    }
  });
});
