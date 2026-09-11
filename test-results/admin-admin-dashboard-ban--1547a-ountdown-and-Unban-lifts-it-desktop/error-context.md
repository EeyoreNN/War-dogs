# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> admin dashboard >> ban a player: the Bans tab shows a live countdown and Unban lifts it
- Location: tests/e2e/admin.spec.ts:64:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-testid="bans-table"] tr[data-steamid="76561198382027487"]').getByRole('button', { name: 'Unban' })
    - locator resolved to <button type="button" class="relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold uppercase tracking-[0.08em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none active:translate-y-px border border-line-strong bg-bg-1 text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-line-hi hover:bg-bg-2 h-8 px-3 text-[11px]">Unban</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <pre class="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed text-fg">{↵  "steamId": "76561198382027487",↵  "reason": "…</pre> from <div role="region" tabindex="-1" aria-labelledby="_r_15_" class="fixed z-[70] flex flex-col border-line bg-bg-1 shadow-panel outline-none inset-y-0 right-0 w-[360px] max-w-full border-l pr-[env(safe-area-inset-right)]">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <pre class="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed text-fg">{↵  "steamId": "76561198382027487",↵  "reason": "…</pre> from <div role="region" tabindex="-1" aria-labelledby="_r_15_" class="fixed z-[70] flex flex-col border-line bg-bg-1 shadow-panel outline-none inset-y-0 right-0 w-[360px] max-w-full border-l pr-[env(safe-area-inset-right)]">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is not stable
  111 × retrying click action
        - waiting 500ms
        - waiting for element to be visible, enabled and stable
        - element is visible, enabled and stable
        - scrolling into view if needed
        - done scrolling
        - <pre class="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed text-fg">{↵  "steamId": "76561198382027487",↵  "reason": "…</pre> from <div role="region" tabindex="-1" aria-labelledby="_r_15_" class="fixed z-[70] flex flex-col border-line bg-bg-1 shadow-panel outline-none inset-y-0 right-0 w-[360px] max-w-full border-l pr-[env(safe-area-inset-right)]">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
        - generic [ref=e18]:
          - generic [ref=e19]: Not real
          - button "Visitor Operator 980E. Change callsign" [ref=e20]:
            - generic [ref=e24]: visitor
            - generic [ref=e25]: Operator 980E
          - button "Reset to 04:00Z snapshot" [ref=e26]
          - generic [ref=e31]: Proof of concept
    - main [ref=e32]:
      - generic [ref=e33]:
        - navigation "Dashboard" [ref=e34]:
          - list [ref=e35]:
            - listitem [ref=e36]:
              - link "Live" [ref=e37] [cursor=pointer]:
                - /url: /demo/admin/live
            - listitem [ref=e38]:
              - link "Rotation" [ref=e39] [cursor=pointer]:
                - /url: /demo/admin/rotation
            - listitem [ref=e40]:
              - link "History" [ref=e41] [cursor=pointer]:
                - /url: /demo/admin/history
            - listitem [ref=e42]:
              - link "Bans" [active] [ref=e43] [cursor=pointer]:
                - /url: /demo/admin/bans
            - listitem [ref=e44]:
              - link "Audit" [ref=e45] [cursor=pointer]:
                - /url: /demo/admin/audit
        - generic [ref=e46]:
          - heading "Bans · Dashboard demo" [level=1] [ref=e47]
          - generic [ref=e48]:
            - generic [ref=e49]:
              - generic [ref=e50]:
                - heading "Active bans · 1" [level=2] [ref=e51]
                - paragraph [ref=e52]: Every ban carries who placed it, why, and the evidence. Demo bans lift on their own; the countdown is live.
              - button "Ban a player…" [ref=e54]
            - table [ref=e59]:
              - caption [ref=e60]: Active bans
              - rowgroup [ref=e61]:
                - row [ref=e62]:
                  - columnheader "Player" [ref=e63]
                  - columnheader "Remaining" [ref=e64]
                  - columnheader "Reason" [ref=e65]
                  - columnheader "Evidence" [ref=e66]
                  - columnheader "Placed" [ref=e67]
                  - columnheader "Actions" [ref=e68]
              - rowgroup [ref=e70]:
                - row [ref=e71]:
                  - cell "Fallo 76561198382027487" [ref=e72]:
                    - text: Fallo
                    - generic [ref=e73]: "76561198382027487"
                  - cell "57m 02s" [ref=e74]
                  - cell "cheating" [ref=e75]
                  - cell [ref=e76]:
                    - link "Open (opens in a new tab)" [ref=e77] [cursor=pointer]:
                      - /url: https://example.test/clip
                      - text: Open
                      - generic [ref=e82]: (opens in a new tab)
                  - cell "13:04:32 by Operator 980E" [ref=e83]:
                    - text: 13:04:32
                    - generic [ref=e84]: by Operator 980E
                  - cell [ref=e85]:
                    - button "Unban" [ref=e86]
          - region [ref=e87]:
            - generic [ref=e88]:
              - heading "What this sends" [level=2] [ref=e89]
              - button "Close" [ref=e90]
            - generic [ref=e95]:
              - generic [ref=e96]:
                - generic [ref=e97]: POST
                - code [ref=e98]: /v1/bans
              - paragraph [ref=e99]: Ban a player · Fallo · "cheating" · 60 min · evidence attached
              - generic [ref=e100]:
                - paragraph [ref=e101]: Body
                - generic [ref=e102]: "{ \"steamId\": \"76561198382027487\", \"reason\": \"cheating\" }"
              - generic [ref=e103]:
                - tablist "Copy as" [ref=e104]:
                  - tab "curl" [selected] [ref=e105]
                  - tab "fetch" [ref=e106]
                  - tab "PowerShell" [ref=e107]
                - tabpanel "curl" [ref=e108]:
                  - generic [ref=e109]: "curl -X POST 'https://your-server-host:7776/v1/bans' \\ -H 'Authorization: Bearer <token>' \\ -H 'Content-Type: application/json' \\ --data-raw '{ \"steamId\": \"76561198382027487\", \"reason\": \"cheating\" }'"
                  - button "Copy as curl" [ref=e110]
              - paragraph [ref=e115]:
                - text: Sent to the in-browser simulator.
                - link "Point the API console at your own server to run it for real." [ref=e116] [cursor=pointer]:
                  - /url: /rcon-api?endpoint=post-v1-bans
              - generic [ref=e117]:
                - checkbox "Don't show automatically" [ref=e118]
                - text: Don't show automatically
  - generic [ref=e119]: Banned for 1h. See the Bans tab for the countdown.
  - alert [ref=e120]: Bans · Dashboard demo · wardogs.tech
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
> 87  |     await banRow.getByRole("button", { name: "Unban" }).click();
      |                                                         ^ Error: locator.click: Test timeout of 60000ms exceeded.
  88  |     await expect(banRow).toHaveCount(0);
  89  |   });
  90  | 
  91  |   test("landing page hero, live card and no horizontal scroll", async ({ page }) => {
  92  |     await page.goto("/demo/admin");
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