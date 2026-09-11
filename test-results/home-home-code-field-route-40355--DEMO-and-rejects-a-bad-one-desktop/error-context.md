# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> home >> code field routes a valid code, DEMO and rejects a bad one
- Location: tests/e2e/home.spec.ts:97:7

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByRole('alert')
Expected: "Codes are 6 letters or digits, never 0, O, 1 or I."
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert" id="hero-code-error" class="text-sm text-danger-text">Codes are 6 letters or digits, never 0, O, 1 or I.</p> aka getByText('Codes are 6 letters or digits')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toHaveText" getByRole('alert') with timeout 10000ms
  - waiting for getByRole('alert')

```

# Page snapshot

```yaml
- generic [active] [ref=f4e1]:
  - generic [ref=f4e2]:
    - link "Skip to content" [ref=f4e3] [cursor=pointer]:
      - /url: "#main"
    - banner [ref=f4e4]:
      - generic [ref=f4e5]:
        - link "wardogs.tech home" [ref=f4e6] [cursor=pointer]:
          - /url: /
          - generic [ref=f4e15]:
            - generic [ref=f4e16]: WARDOGS
            - generic [ref=f4e17]: .TECH
        - navigation "Primary" [ref=f4e18]:
          - link "How it works" [ref=f4e19] [cursor=pointer]:
            - /url: /#how
          - link "Demo" [ref=f4e20] [cursor=pointer]:
            - /url: /demo
          - link "Developers" [ref=f4e21] [cursor=pointer]:
            - /url: /dev
          - link "Our Discord" [ref=f4e22] [cursor=pointer]:
            - /url: https://discord.gg/FhWDZQn9Gy
          - link "Add to Discord" [ref=f4e25] [cursor=pointer]:
            - /url: /add
    - main [ref=f4e28]:
      - region [ref=f4e29]:
        - generic [ref=f4e31]:
          - generic [ref=f4e32]:
            - paragraph [ref=f4e33]: Discord Activity · Free · Fan-made
            - heading "The tactical map for your Wardogs Discord" [level=1] [ref=f4e34]
            - paragraph [ref=f4e35]: Open it in a voice channel. Everyone in the call draws on the same map.
            - generic [ref=f4e36]:
              - link "Try the live demo" [ref=f4e37] [cursor=pointer]:
                - /url: /demo
              - link "Not an admin? Add it to your own account instead." [ref=f4e38] [cursor=pointer]:
                - /url: /add?to=account
              - generic [ref=f4e39]:
                - link "Add to your server Setup required" [ref=f4e40] [cursor=pointer]:
                  - /url: /add
                  - text: Add to your server
                  - generic [ref=f4e43]: Setup required
                - link "Open a war room" [ref=f4e44] [cursor=pointer]:
                  - /url: /create
                - link "Join a war room" [ref=f4e47] [cursor=pointer]:
                  - /url: /join
              - generic [ref=f4e50]:
                - generic [ref=f4e51]: Have a code?
                - generic [ref=f4e52]:
                  - textbox "War room code" [invalid] [ref=f4e53]:
                    - /placeholder: ABC234
                    - text: AB
                  - button "Open war room" [ref=f4e54]
                - alert [ref=f4e57]: Codes are 6 letters or digits, never 0, O, 1 or I.
          - group "Live preview of the shared map; press Enter to open the demo" [ref=f4e59]:
            - generic [aria-hidden] [ref=f4e60]:
              - generic [ref=f4e68]: War room Demo
              - generic [ref=f4e69]: Live
            - generic [ref=f4e71]: Map preview loading
            - link "This is the real app — take over →" [ref=f4e83] [cursor=pointer]:
              - /url: /demo
      - region [ref=f4e84]:
        - generic [ref=f4e85]:
          - generic [ref=f4e86]:
            - paragraph [ref=f4e87]: How it works
            - heading "Three clicks to a shared map" [level=2] [ref=f4e88]
          - list [ref=f4e89]:
            - listitem [ref=f4e90]:
              - generic [ref=f4e91]:
                - generic [aria-hidden]: "01"
                - generic [ref=f4e92]: "01"
                - heading "Add it to your server" [level=3] [ref=f4e93]
                - paragraph [ref=f4e94]: One click on the button above. That is the setup.
                - generic [ref=f4e95]:
                  - generic [aria-hidden]: Add to your server
            - listitem [ref=f4e96]:
              - generic [ref=f4e97]:
                - generic [aria-hidden]: "02"
                - generic [ref=f4e98]: "02"
                - heading "Press Start an Activity" [level=3] [ref=f4e99]
                - paragraph [ref=f4e100]: The rocket button in a voice call.
                - generic [ref=f4e101]: Start an Activity
            - listitem [ref=f4e123]:
              - generic [ref=f4e124]:
                - generic [aria-hidden]: "03"
                - generic [ref=f4e125]: "03"
                - heading "Pick wardogs.tech" [level=3] [ref=f4e126]
                - paragraph [ref=f4e127]: Everyone in the call lands in the same room.
                - generic [aria-hidden] [ref=f4e129]:
                  - generic [ref=f4e137]: ABC234
                  - generic [ref=f4e138]: Live
                  - generic [ref=f4e140]: ·
                  - generic [ref=f4e141]: 4 in room
      - region "Where to next" [ref=f4e142]:
        - list [ref=f4e144]:
          - listitem [ref=f4e145]:
            - link [ref=f4e146] [cursor=pointer]:
              - /url: /demo
              - paragraph [ref=f4e150]: Just looking
              - heading "The live demo" [level=3] [ref=f4e155]
              - paragraph [ref=f4e156]: A shared map with people in it right now. No sign-in.
          - listitem [ref=f4e157]:
            - link [ref=f4e158] [cursor=pointer]:
              - /url: /dev
              - paragraph [ref=f4e162]: Run a server
              - heading "Docs for server owners" [level=3] [ref=f4e166]
              - paragraph [ref=f4e167]: The RCON reference, the config guide and an API console. Public, no account.
          - listitem [ref=f4e168]:
            - link [ref=f4e169] [cursor=pointer]:
              - /url: /demo/admin
              - paragraph [ref=f4e173]: Coming soon
              - heading "Server admin in the same Discord" [level=3] [ref=f4e178]
              - paragraph [ref=f4e179]: Live players, match history, bans with evidence. In closed testing; click around the preview.
      - region [ref=f4e180]:
        - generic [ref=f4e181]:
          - generic [ref=f4e182]:
            - paragraph [ref=f4e183]: Questions
            - heading "Before you add it" [level=2] [ref=f4e184]
          - generic [ref=f4e185]:
            - group [ref=f4e186]:
              - generic "Do my squadmates need to install anything?" [ref=f4e187] [cursor=pointer]
            - group [ref=f4e190]:
              - generic "Does it work outside Discord?" [ref=f4e191] [cursor=pointer]
            - group [ref=f4e194]:
              - generic "Do you store our plans?" [ref=f4e195] [cursor=pointer]
            - group [ref=f4e198]:
              - generic "Which maps?" [ref=f4e199] [cursor=pointer]
            - group [ref=f4e202]:
              - generic "Is it free?" [ref=f4e203] [cursor=pointer]
    - contentinfo [ref=f4e206]:
      - generic [ref=f4e207]:
        - generic [ref=f4e208]:
          - generic [ref=f4e217]:
            - generic [ref=f4e218]: WARDOGS
            - generic [ref=f4e219]: .TECH
          - generic [ref=f4e220]: v0.2.0
        - paragraph [ref=f4e221]: Fan-made. Not affiliated with Bulkhead or Team17.
        - navigation "Footer" [ref=f4e222]:
          - link "Community Discord" [ref=f4e223] [cursor=pointer]:
            - /url: https://discord.gg/FhWDZQn9Gy
          - link "GitHub" [ref=f4e224] [cursor=pointer]:
            - /url: https://github.com/EeyoreNN/War-dogs
          - link "Terms" [ref=f4e225] [cursor=pointer]:
            - /url: /terms
          - link "Privacy" [ref=f4e226] [cursor=pointer]:
            - /url: /privacy
  - alert [ref=f4e228]
```

# Test source

```ts
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
  76  |     expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
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
> 112 |     await expect(page.getByRole("alert")).toHaveText(
      |                                           ^ Error: expect(locator).toHaveText(expected) failed
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