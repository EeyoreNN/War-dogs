# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: seo.spec.ts >> seo >> robots allows the site and disallows private routes
- Location: tests/e2e/seo.spec.ts:17:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "Sitemap: http://127.0.0.1:3100/sitemap.xml"
Received string:    "User-Agent: *
Allow: /
Disallow: /room/
Disallow: /r/
Disallow: /activity
Disallow: /add
Disallow: /terrain/
Disallow: /demo/admin/live
Disallow: /demo/admin/rotation
Disallow: /demo/admin/history
Disallow: /demo/admin/bans
Disallow: /demo/admin/audit·
Sitemap: https://wardogs.tech/sitemap.xml
"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3100";
  4  | 
  5  | test.describe("seo", () => {
  6  |   test("sitemap lists the public routes with absolute URLs", async ({ request }) => {
  7  |     const res = await request.get("/sitemap.xml");
  8  |     expect(res.status()).toBe(200);
  9  |     expect(res.headers()["content-type"]).toContain("xml");
  10 |     const xml = await res.text();
  11 |     for (const path of ["/", "/demo", "/create", "/join", "/dev", "/terms", "/privacy"]) {
  12 |       expect(xml).toContain(`<loc>${new URL(path, siteUrl).toString()}</loc>`);
  13 |     }
  14 |     expect(xml).not.toContain("/room/");
  15 |   });
  16 | 
  17 |   test("robots allows the site and disallows private routes", async ({ request }) => {
  18 |     const res = await request.get("/robots.txt");
  19 |     expect(res.status()).toBe(200);
  20 |     const txt = await res.text();
  21 |     expect(txt).toMatch(/Allow: \//);
  22 |     for (const p of ["/room/", "/r/", "/activity", "/add", "/terrain/", "/demo/admin/live"]) {
  23 |       expect(txt).toContain(`Disallow: ${p}`);
  24 |     }
> 25 |     expect(txt).toContain(`Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}`);
     |                 ^ Error: expect(received).toContain(expected) // indexOf
  26 |   });
  27 | 
  28 |   test("web manifest", async ({ request }) => {
  29 |     const res = await request.get("/manifest.webmanifest");
  30 |     expect(res.status()).toBe(200);
  31 |     const json = await res.json();
  32 |     expect(json.name).toBe("wardogs.tech");
  33 |     expect(json.short_name).toBe("Wardogs map");
  34 |     expect(json.display).toBe("standalone");
  35 |     expect(json.start_url).toBe("/join");
  36 |     expect(json.icons.some((i: { src: string }) => i.src === "/icon")).toBe(true);
  37 |   });
  38 | 
  39 |   test("canonical tags on public routes", async ({ page }) => {
  40 |     for (const path of ["/", "/terms", "/privacy"]) {
  41 |       await page.goto(path);
  42 |       const href = await page.locator('link[rel="canonical"]').getAttribute("href");
  43 |       expect(href).toBe(new URL(path, siteUrl).toString());
  44 |     }
  45 |   });
  46 | 
  47 |   test("noindex on room routes, /add and the 404", async ({ page }) => {
  48 |     for (const path of ["/room/ABC234", "/add", "/this-does-not-exist"]) {
  49 |       await page.goto(path);
  50 |       const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  51 |       expect(robots, path).toMatch(/noindex/);
  52 |     }
  53 |   });
  54 | 
  55 |   test("JSON-LD parses and carries the FAQ", async ({ page }) => {
  56 |     await page.goto("/");
  57 |     const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  58 |     expect(blocks.length).toBeGreaterThanOrEqual(3);
  59 |     const parsed = blocks.map((b) => JSON.parse(b) as { "@type": string; mainEntity?: unknown[] });
  60 |     const types = parsed.map((p) => p["@type"]);
  61 |     expect(types).toEqual(expect.arrayContaining(["WebSite", "SoftwareApplication", "FAQPage"]));
  62 |     const faq = parsed.find((p) => p["@type"] === "FAQPage");
  63 |     expect(faq?.mainEntity).toHaveLength(5);
  64 |   });
  65 | 
  66 |   test("og:image:alt is set", async ({ page }) => {
  67 |     await page.goto("/");
  68 |     await expect(page.locator('meta[property="og:image:alt"]')).toHaveCount(1);
  69 |   });
  70 | });
  71 | 
```