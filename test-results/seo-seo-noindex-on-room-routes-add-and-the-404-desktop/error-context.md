# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: seo.spec.ts >> seo >> noindex on room routes, /add and the 404
- Location: tests/e2e/seo.spec.ts:47:7

# Error details

```
Error: locator.getAttribute: Error: strict mode violation: locator('meta[name="robots"]') resolved to 2 elements:
    1) <meta name="robots" content="noindex"/> aka locator('meta[name="robots"]').first()
    2) <meta name="robots" content="noindex, nofollow"/> aka locator('meta[name="robots"]').nth(1)

Call log:
  - waiting for locator('meta[name="robots"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "Skip to content" [ref=e3] [cursor=pointer]:
      - /url: "#main"
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "wardogs.tech home" [ref=e6] [cursor=pointer]:
          - /url: /
          - generic [ref=e15]:
            - generic [ref=e16]: WARDOGS
            - generic [ref=e17]: .TECH
        - navigation "Primary" [ref=e18]:
          - link "How it works" [ref=e19] [cursor=pointer]:
            - /url: /#how
          - link "Demo" [ref=e20] [cursor=pointer]:
            - /url: /demo
          - link "Developers" [ref=e21] [cursor=pointer]:
            - /url: /dev
          - link "Our Discord" [ref=e22] [cursor=pointer]:
            - /url: https://discord.gg/FhWDZQn9Gy
          - link "Add to Discord" [ref=e25] [cursor=pointer]:
            - /url: /add
    - main [ref=e28]:
      - generic [ref=e30]:
        - paragraph [ref=e31]: "404"
        - heading "Nothing at this position" [level=1] [ref=e32]
        - paragraph [ref=e33]:
          - text: The page you asked for is not on the map. If you were sent a war room link, the code goes after
          - code [ref=e34]: /room/
          - text: .
        - generic [ref=e35]:
          - generic [ref=e36]: Have a code?
          - generic [ref=e37]:
            - textbox "War room code" [ref=e38]:
              - /placeholder: ABC234
            - button "Open war room" [ref=e39]
        - generic [ref=e42]:
          - link "Try the live demo" [ref=e43] [cursor=pointer]:
            - /url: /demo
          - link "Join a war room" [ref=e44] [cursor=pointer]:
            - /url: /join
          - link "Home" [ref=e45] [cursor=pointer]:
            - /url: /
    - contentinfo [ref=e46]:
      - generic [ref=e47]:
        - generic [ref=e48]:
          - generic [ref=e57]:
            - generic [ref=e58]: WARDOGS
            - generic [ref=e59]: .TECH
          - generic [ref=e60]: v0.2.0
        - paragraph [ref=e61]: Fan-made. Not affiliated with Bulkhead or Team17.
        - navigation "Footer" [ref=e62]:
          - link "Community Discord" [ref=e63] [cursor=pointer]:
            - /url: https://discord.gg/FhWDZQn9Gy
          - link "GitHub" [ref=e64] [cursor=pointer]:
            - /url: https://github.com/EeyoreNN/War-dogs
          - link "Terms" [ref=e65] [cursor=pointer]:
            - /url: /terms
          - link "Privacy" [ref=e66] [cursor=pointer]:
            - /url: /privacy
  - alert [ref=e68]
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
> 50 |       const robots = await page.locator('meta[name="robots"]').getAttribute("content");
     |                                                                ^ Error: locator.getAttribute: Error: strict mode violation: locator('meta[name="robots"]') resolved to 2 elements:
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