# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> admin dashboard >> landing page hero, live card and no horizontal scroll
- Location: tests/e2e/admin.spec.ts:91:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/demo/admin
Call log:
  - navigating to "http://127.0.0.1:3100/demo/admin", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | /*
  4   |  * §7.2 spec 7: /demo/admin/live → kick a player (reason) → row disappears → audit shows `you`
  5   |  * → run the clock 300 s → the player returns; ban → Bans tab shows a countdown; the
  6   |  * "What this sends" sheet shows `POST /v1/players/{steamId}/kick`.
  7   |  */
  8   | 
  9   | const EPOCH = Date.UTC(2026, 8, 11, 13, 4, 31); // a fixed instant so the roster is deterministic
  10  | 
  11  | async function openLive(page: Page) {
  12  |   await page.clock.install({ time: EPOCH });
  13  |   await page.goto("/demo/admin/live");
  14  |   await expect(page.getByTestId("live-server-card")).toBeVisible();
  15  |   await expect(page.getByTestId("players-table")).toBeVisible();
  16  | }
  17  | 
  18  | test.describe("admin dashboard", () => {
  19  |   test("kick a player: row disappears, audit says you, they return within 300 s, sheet shows the call", async ({
  20  |     page,
  21  |   }) => {
  22  |     await openLive(page);
  23  |     const row = page.getByTestId("players-table").locator("tbody tr").first();
  24  |     const steamId = await row.getAttribute("data-steamid");
  25  |     const name = (await row.locator("td").first().innerText()).trim().split("\n")[0];
  26  |     expect(steamId).toMatch(/^\d{17}$/);
  27  | 
  28  |     await row.getByRole("button", { name: `Actions for ${name}` }).click();
  29  |     await page.getByRole("menuitem", { name: "Kick…" }).click();
  30  |     const dialog = page.getByRole("dialog");
  31  |     await dialog.getByLabel(/Reason/).fill("team killing");
  32  |     await dialog.getByRole("button", { name: "Kick", exact: true }).click();
  33  | 
  34  |     await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(0);
  35  | 
  36  |     // The "What this sends" sheet opened automatically with the exact RCON call.
  37  |     const sheet = page.getByRole("region", { name: "What this sends" });
  38  |     await expect(sheet).toBeVisible();
  39  |     await expect(sheet.getByText("POST")).toBeVisible();
  40  |     await expect(sheet.getByText(`/v1/players/${steamId}/kick`)).toBeVisible();
  41  |     await expect(sheet.getByTestId("sheet-snippet-curl")).toContainText("Authorization: Bearer");
  42  |     await sheet.getByRole("button", { name: "Close" }).click();
  43  | 
  44  |     // Audit shows the row under the visitor with the `you` badge.
  45  |     await page
  46  |       .getByRole("navigation", { name: "Dashboard" })
  47  |       .getByRole("link", { name: "Audit" })
  48  |       .click();
  49  |     const mine = page.locator('[data-testid="audit-row"][data-mine="true"]').first();
  50  |     await expect(mine).toContainText("kick");
  51  |     await expect(mine).toContainText(name);
  52  |     await expect(mine).toContainText('"team killing"');
  53  |     await expect(mine.getByText("you", { exact: true })).toBeVisible();
  54  | 
  55  |     // Kicked players come back on their own within 90–300 s.
  56  |     await page
  57  |       .getByRole("navigation", { name: "Dashboard" })
  58  |       .getByRole("link", { name: "Live" })
  59  |       .click();
  60  |     await page.clock.runFor(300_000);
  61  |     await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(1);
  62  |   });
  63  | 
  64  |   test("ban a player: the Bans tab shows a live countdown and Unban lifts it", async ({ page }) => {
  65  |     await openLive(page);
  66  |     const row = page.getByTestId("players-table").locator("tbody tr").nth(1);
  67  |     const steamId = await row.getAttribute("data-steamid");
  68  |     const name = (await row.locator("td").first().innerText()).trim().split("\n")[0];
  69  | 
  70  |     await row.getByRole("button", { name: `Actions for ${name}` }).click();
  71  |     await page.getByRole("menuitem", { name: "Ban…" }).click();
  72  |     const dialog = page.getByRole("dialog");
  73  |     await dialog.getByLabel(/Reason/).fill("cheating");
  74  |     await dialog.getByLabel(/Evidence URL/).fill("https://example.test/clip");
  75  |     await dialog.getByRole("button", { name: "Ban for 1h" }).click();
  76  |     await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(0);
  77  | 
  78  |     await page
  79  |       .getByRole("navigation", { name: "Dashboard" })
  80  |       .getByRole("link", { name: "Bans" })
  81  |       .click();
  82  |     const banRow = page.locator(`[data-testid="bans-table"] tr[data-steamid="${steamId}"]`);
  83  |     await expect(banRow).toBeVisible();
  84  |     await expect(banRow.getByTestId("ban-countdown")).toHaveText(/59m|1h 00m/);
  85  |     await page.clock.runFor(120_000);
  86  |     await expect(banRow.getByTestId("ban-countdown")).toHaveText(/5[6-8]m/);
  87  |     await banRow.getByRole("button", { name: "Unban" }).click();
  88  |     await expect(banRow).toHaveCount(0);
  89  |   });
  90  | 
  91  |   test("landing page hero, live card and no horizontal scroll", async ({ page }) => {
> 92  |     await page.goto("/demo/admin");
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3100/demo/admin
  93  |     await expect(page.getByRole("heading", { level: 1 })).toContainText(
  94  |       "Run a Wardogs server from one dashboard",
  95  |     );
  96  |     await expect(page.getByTestId("live-server-card")).toBeVisible();
  97  |     await expect(page.getByRole("link", { name: /Open the dashboard/ }).first()).toHaveAttribute(
  98  |       "href",
  99  |       "/demo/admin/live",
  100 |     );
  101 |     const [sw, iw] = await page.evaluate(() => [
  102 |       document.documentElement.scrollWidth,
  103 |       window.innerWidth,
  104 |     ]);
  105 |     expect(sw).toBeLessThanOrEqual(iw);
  106 |   });
  107 | });
  108 | 
```