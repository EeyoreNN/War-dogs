# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: seo.spec.ts >> seo >> sitemap lists the public routes with absolute URLs
- Location: tests/e2e/seo.spec.ts:6:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "<loc>http://127.0.0.1:3100/</loc>"
Received string:    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">
<url>
<loc>https://wardogs.tech/</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>weekly</changefreq>
<priority>1</priority>
</url>
<url>
<loc>https://wardogs.tech/demo</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>daily</changefreq>
<priority>0.8</priority>
</url>
<url>
<loc>https://wardogs.tech/create</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.6</priority>
</url>
<url>
<loc>https://wardogs.tech/join</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.6</priority>
</url>
<url>
<loc>https://wardogs.tech/dev</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://wardogs.tech/rcon-reference</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://wardogs.tech/rcon-api</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://wardogs.tech/discord-help</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://wardogs.tech/map-guide</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://wardogs.tech/demo/admin</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.5</priority>
</url>
<url>
<loc>https://wardogs.tech/terms</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>yearly</changefreq>
<priority>0.2</priority>
</url>
<url>
<loc>https://wardogs.tech/privacy</loc>
<lastmod>2026-09-11T00:00:00.000Z</lastmod>
<changefreq>yearly</changefreq>
<priority>0.2</priority>
</url>
</urlset>
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
> 12 |       expect(xml).toContain(`<loc>${new URL(path, siteUrl).toString()}</loc>`);
     |                   ^ Error: expect(received).toContain(expected) // indexOf
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
  25 |     expect(txt).toContain(`Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}`);
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