import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * §6.2: every page with its own OG image advertises it in `<meta property="og:image">` and that
 * URL answers 200 `image/png` at 1200×630. Next 16 emits nested metadata image routes with a
 * hash suffix (`/demo/opengraph-image-16n939`), so the spec never hardcodes those paths — it
 * reads them off each page. §3.7: the terrain route is immutable-cached SVG within budget and
 * 404s on anything it does not recognise.
 */
const OG_PAGES = ["/", "/demo", "/dev", "/demo/admin", "/room/ABC123", "/create", "/join"];

/** The root images (§6.2) keep their fixed, hash-free URLs. */
const ROOT_IMAGES = ["/opengraph-image", "/twitter-image"];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function expectPng1200x630(request: APIRequestContext, url: string) {
  const res = await request.get(url);
  expect(res.status(), url).toBe(200);
  expect(res.headers()["content-type"], url).toContain("image/png");
  const body = await res.body();
  // PNG signature, then the IHDR chunk: width and height are the two big-endian u32 at 16 / 20.
  expect(body.subarray(0, 8), url).toEqual(PNG_SIGNATURE);
  expect(body.readUInt32BE(16), url).toBe(1200);
  expect(body.readUInt32BE(20), url).toBe(630);
  return body;
}

async function ogImageOf(page: Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  const url = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(url, `${path} has an og:image`).toBeTruthy();
  return url as string;
}

test.describe("OG images", () => {
  for (const route of ROOT_IMAGES) {
    test(`${route} is a 1200×630 PNG`, async ({ request }) => {
      await expectPng1200x630(request, route);
    });
  }

  for (const path of OG_PAGES) {
    test(`${path} advertises a 1200×630 PNG og:image`, async ({ page, request }) => {
      const url = await ogImageOf(page, path);
      await expectPng1200x630(request, url);
    });
  }

  test("the room OG never contains the code", async ({ page, request }) => {
    // The PNG cannot be text-searched; the guarantee is that the route ignores the code entirely,
    // so two codes render byte-identical images.
    const a = await expectPng1200x630(request, await ogImageOf(page, "/room/ABC123"));
    const b = await expectPng1200x630(request, await ogImageOf(page, "/room/ZZZ999"));
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
