# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> home >> hero copy, CTAs and no console errors
- Location: tests/e2e/home.spec.ts:37:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 6

- Array []
+ Array [
+   "Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "Failed to load resource: the server responded with a status of 404 (Not Found)",
+   "Failed to load resource: the server responded with a status of 404 (Not Found)",
+ ]
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
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | /** LCP / CLS via PerformanceObserver; soft annotations, hard failure only past 4000 ms / 0.25 (§7.2). */
  4   | async function readVitals(page: Page) {
  5   |   return page.evaluate(
  6   |     () =>
  7   |       new Promise<{ lcp: number; cls: number; lcpTag: string }>((resolve) => {
  8   |         let lcp = 0;
  9   |         let lcpTag = "";
  10  |         let cls = 0;
  11  |         try {
  12  |           new PerformanceObserver((list) => {
  13  |             for (const e of list.getEntries() as (PerformanceEntry & { element?: Element })[]) {
  14  |               lcp = e.startTime;
  15  |               lcpTag = e.element
  16  |                 ? `${e.element.tagName}${e.element.id ? "#" + e.element.id : ""}`
  17  |                 : "";
  18  |             }
  19  |           }).observe({ type: "largest-contentful-paint", buffered: true });
  20  |           new PerformanceObserver((list) => {
  21  |             for (const e of list.getEntries() as (PerformanceEntry & {
  22  |               hadRecentInput?: boolean;
  23  |               value?: number;
  24  |             })[]) {
  25  |               if (!e.hadRecentInput) cls += e.value ?? 0;
  26  |             }
  27  |           }).observe({ type: "layout-shift", buffered: true });
  28  |         } catch {
  29  |           /* unsupported: report zeros */
  30  |         }
  31  |         setTimeout(() => resolve({ lcp, cls, lcpTag }), 1200);
  32  |       }),
  33  |   );
  34  | }
  35  | 
  36  | test.describe("home", () => {
  37  |   test("hero copy, CTAs and no console errors", async ({ page }) => {
  38  |     const errors: string[] = [];
  39  |     page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  40  |     page.on("pageerror", (e) => errors.push(e.message));
  41  | 
  42  |     await page.goto("/");
  43  |     await expect(page.getByRole("heading", { level: 1 })).toHaveText(
  44  |       "The tactical map for your Wardogs Discord",
  45  |     );
  46  |     await expect(
  47  |       page.getByText("Open it in a voice channel. Everyone in the call draws on the same map."),
  48  |     ).toBeVisible();
  49  |     await expect(page.getByRole("link", { name: "Open a war room" })).toHaveAttribute(
  50  |       "href",
  51  |       "/create",
  52  |     );
  53  |     await expect(page.getByRole("link", { name: "Join a war room" })).toHaveAttribute(
  54  |       "href",
  55  |       "/join",
  56  |     );
  57  |     await expect(page.getByRole("link", { name: /Not an admin\?/ })).toHaveAttribute(
  58  |       "href",
  59  |       "/add?to=account",
  60  |     );
  61  |     await expect(page.getByRole("heading", { name: "Three clicks to a shared map" })).toBeVisible();
  62  |     await expect(page.getByRole("link", { name: /The live demo/ })).toHaveAttribute(
  63  |       "href",
  64  |       "/demo",
  65  |     );
  66  | 
  67  |     const vitals = await readVitals(page);
  68  |     test
  69  |       .info()
  70  |       .annotations.push(
  71  |         { type: "LCP", description: `${Math.round(vitals.lcp)} ms (${vitals.lcpTag})` },
  72  |         { type: "CLS", description: vitals.cls.toFixed(3) },
  73  |       );
  74  |     expect(vitals.lcp).toBeLessThan(4000);
  75  |     expect(vitals.cls).toBeLessThan(0.25);
> 76  |     expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
      |                                                      ^ Error: expect(received).toEqual(expected) // deep equality
  77  |   });
  78  | 
  79  |   test("OG image route responds with a PNG", async ({ request }) => {
  80  |     const res = await request.get("/opengraph-image");
  81  |     expect(res.status()).toBe(200);
  82  |     expect(res.headers()["content-type"]).toContain("image/png");
  83  |   });
  84  | 
  85  |   test("FAQ disclosures toggle", async ({ page }) => {
  86  |     await page.goto("/");
  87  |     const first = page.locator("details").first();
  88  |     const summary = first.locator("summary");
  89  |     await expect(first).not.toHaveAttribute("open", "");
  90  |     await summary.click();
  91  |     await expect(first).toHaveAttribute("open", "");
  92  |     await expect(first.getByText(/One admin adds it to the server once/)).toBeVisible();
  93  |     await summary.click();
  94  |     await expect(first).not.toHaveAttribute("open", "");
  95  |   });
  96  | 
  97  |   test("code field routes a valid code, DEMO and rejects a bad one", async ({ page }) => {
  98  |     await page.goto("/");
  99  |     const field = page.getByRole("textbox", { name: "War room code" });
  100 |     await field.fill("abc234");
  101 |     await field.press("Enter");
  102 |     await expect(page).toHaveURL(/\/room\/ABC234$/);
  103 | 
  104 |     await page.goto("/");
  105 |     await field.fill("demo");
  106 |     await field.press("Enter");
  107 |     await expect(page).toHaveURL(/\/demo$/);
  108 | 
  109 |     await page.goto("/");
  110 |     await field.fill("ab0");
  111 |     await field.press("Enter");
  112 |     await expect(page.getByRole("alert")).toHaveText(
  113 |       "Codes are 6 letters or digits, never 0, O, 1 or I.",
  114 |     );
  115 |     await expect(page).toHaveURL(/\/$/);
  116 |   });
  117 | 
  118 |   test("rejoin card lists recent rooms and forgets one", async ({ page }) => {
  119 |     await page.addInitScript(() => {
  120 |       localStorage.setItem(
  121 |         "wardogs:rooms",
  122 |         JSON.stringify([
  123 |           {
  124 |             code: "X5GM4Q",
  125 |             team: "Lonestar",
  126 |             map: "zestafona",
  127 |             controlZone: "default",
  128 |             role: "commander",
  129 |             updatedAt: Date.now() - 12 * 60_000,
  130 |           },
  131 |         ]),
  132 |       );
  133 |     });
  134 |     await page.goto("/");
  135 |     const row = page.getByRole("link", { name: /X5GM4Q/ });
  136 |     await expect(row).toHaveAttribute("href", "/room/X5GM4Q");
  137 |     await expect(row).toContainText("12 min ago");
  138 |     await page.getByRole("button", { name: "Forget X5GM4Q" }).click();
  139 |     await expect(row).toHaveCount(0);
  140 |   });
  141 | 
  142 |   test("no horizontal scroll", async ({ page }) => {
  143 |     await page.goto("/");
  144 |     const [sw, iw] = await page.evaluate(() => [
  145 |       document.documentElement.scrollWidth,
  146 |       window.innerWidth,
  147 |     ]);
  148 |     expect(sw).toBeLessThanOrEqual(iw);
  149 |   });
  150 | });
  151 | 
```