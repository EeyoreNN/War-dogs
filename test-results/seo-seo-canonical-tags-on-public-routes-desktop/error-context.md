# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: seo.spec.ts >> seo >> canonical tags on public routes
- Location: tests/e2e/seo.spec.ts:39:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "http://127.0.0.1:3100/"
Received: "https://wardogs.tech"
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
      - region [ref=e29]:
        - generic [ref=e31]:
          - generic [ref=e32]:
            - paragraph [ref=e33]: Discord Activity · Free · Fan-made
            - heading "The tactical map for your Wardogs Discord" [level=1] [ref=e34]
            - paragraph [ref=e35]: Open it in a voice channel. Everyone in the call draws on the same map.
            - generic [ref=e36]:
              - link "Try the live demo" [ref=e37] [cursor=pointer]:
                - /url: /demo
              - link "Not an admin? Add it to your own account instead." [ref=e38] [cursor=pointer]:
                - /url: /add?to=account
              - generic [ref=e39]:
                - link "Add to your server Setup required" [ref=e40] [cursor=pointer]:
                  - /url: /add
                  - text: Add to your server
                  - generic [ref=e43]: Setup required
                - link "Open a war room" [ref=e44] [cursor=pointer]:
                  - /url: /create
                - link "Join a war room" [ref=e47] [cursor=pointer]:
                  - /url: /join
              - generic [ref=e50]:
                - generic [ref=e51]: Have a code?
                - generic [ref=e52]:
                  - textbox "War room code" [ref=e53]:
                    - /placeholder: ABC234
                  - button "Open war room" [ref=e54]
          - group "Live preview of the shared map; press Enter to open the demo" [ref=e58]:
            - generic [aria-hidden] [ref=e59]:
              - generic [ref=e67]: War room Demo
              - generic [ref=e68]: Live
            - generic [ref=e70]: Map preview loading
            - link "This is the real app — take over →" [ref=e82] [cursor=pointer]:
              - /url: /demo
      - region [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]:
            - paragraph [ref=e86]: How it works
            - heading "Three clicks to a shared map" [level=2] [ref=e87]
          - list [ref=e88]:
            - listitem [ref=e89]:
              - generic [ref=e90]:
                - generic [aria-hidden]: "01"
                - generic [ref=e91]: "01"
                - heading "Add it to your server" [level=3] [ref=e92]
                - paragraph [ref=e93]: One click on the button above. That is the setup.
                - generic [ref=e94]:
                  - generic [aria-hidden]: Add to your server
            - listitem [ref=e95]:
              - generic [ref=e96]:
                - generic [aria-hidden]: "02"
                - generic [ref=e97]: "02"
                - heading "Press Start an Activity" [level=3] [ref=e98]
                - paragraph [ref=e99]: The rocket button in a voice call.
                - generic [ref=e100]: Start an Activity
            - listitem [ref=e122]:
              - generic [ref=e123]:
                - generic [aria-hidden]: "03"
                - generic [ref=e124]: "03"
                - heading "Pick wardogs.tech" [level=3] [ref=e125]
                - paragraph [ref=e126]: Everyone in the call lands in the same room.
                - generic [aria-hidden] [ref=e128]:
                  - generic [ref=e136]: ABC234
                  - generic [ref=e137]: Live
                  - generic [ref=e139]: ·
                  - generic [ref=e140]: 4 in room
      - region "Where to next" [ref=e141]:
        - list [ref=e143]:
          - listitem [ref=e144]:
            - link [ref=e145] [cursor=pointer]:
              - /url: /demo
              - paragraph [ref=e149]: Just looking
              - heading "The live demo" [level=3] [ref=e154]
              - paragraph [ref=e155]: A shared map with people in it right now. No sign-in.
          - listitem [ref=e156]:
            - link [ref=e157] [cursor=pointer]:
              - /url: /dev
              - paragraph [ref=e161]: Run a server
              - heading "Docs for server owners" [level=3] [ref=e165]
              - paragraph [ref=e166]: The RCON reference, the config guide and an API console. Public, no account.
          - listitem [ref=e167]:
            - link [ref=e168] [cursor=pointer]:
              - /url: /demo/admin
              - paragraph [ref=e172]: Coming soon
              - heading "Server admin in the same Discord" [level=3] [ref=e177]
              - paragraph [ref=e178]: Live players, match history, bans with evidence. In closed testing; click around the preview.
      - region [ref=e179]:
        - generic [ref=e180]:
          - generic [ref=e181]:
            - paragraph [ref=e182]: Questions
            - heading "Before you add it" [level=2] [ref=e183]
          - generic [ref=e184]:
            - group [ref=e185]:
              - generic "Do my squadmates need to install anything?" [ref=e186] [cursor=pointer]
            - group [ref=e189]:
              - generic "Does it work outside Discord?" [ref=e190] [cursor=pointer]
            - group [ref=e193]:
              - generic "Do you store our plans?" [ref=e194] [cursor=pointer]
            - group [ref=e197]:
              - generic "Which maps?" [ref=e198] [cursor=pointer]
            - group [ref=e201]:
              - generic "Is it free?" [ref=e202] [cursor=pointer]
    - contentinfo [ref=e205]:
      - generic [ref=e206]:
        - generic [ref=e207]:
          - generic [ref=e216]:
            - generic [ref=e217]: WARDOGS
            - generic [ref=e218]: .TECH
          - generic [ref=e219]: v0.2.0
        - paragraph [ref=e220]: Fan-made. Not affiliated with Bulkhead or Team17.
        - navigation "Footer" [ref=e221]:
          - link "Community Discord" [ref=e222] [cursor=pointer]:
            - /url: https://discord.gg/FhWDZQn9Gy
          - link "GitHub" [ref=e223] [cursor=pointer]:
            - /url: https://github.com/EeyoreNN/War-dogs
          - link "Terms" [ref=e224] [cursor=pointer]:
            - /url: /terms
          - link "Privacy" [ref=e225] [cursor=pointer]:
            - /url: /privacy
  - alert [ref=e227]
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
> 43 |       expect(href).toBe(new URL(path, siteUrl).toString());
     |                    ^ Error: expect(received).toBe(expected) // Object.is equality
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