# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> admin dashboard >> kick a player: row disappears, audit says you, they return within 300 s, sheet shows the call
- Location: tests/e2e/admin.spec.ts:19:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('region', { name: 'What this sends' }).getByText('POST')
Expected: visible
Error: strict mode violation: getByRole('region', { name: 'What this sends' }).getByText('POST') resolved to 4 elements:
    1) <span class="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] leading-4 tracking-[0.16em] uppercase border-info/40 bg-info/10 text-info">POST</span> aka getByText('POST', { exact: true })
    2) <pre data-testid="sheet-snippet-curl" class="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg">curl -X POST 'https://your-server-host:7776/v1/pl…</pre> aka getByTestId('sheet-snippet-curl')
    3) <pre data-testid="sheet-snippet-fetch" class="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg">const res = await fetch("https://your-server-host…</pre> aka getByTestId('sheet-snippet-fetch')
    4) <pre data-testid="sheet-snippet-powershell" class="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg">Invoke-RestMethod -Method Post -Uri 'https://your…</pre> aka getByTestId('sheet-snippet-powershell')

Call log:
  - Expect "toBeVisible" getByRole('region', { name: 'What this sends' }).getByText('POST') with timeout 10000ms
  - waiting for getByRole('region', { name: 'What this sends' }).getByText('POST')

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
        - generic [ref=e18]:
          - generic [ref=e19]: Not real
          - button "Visitor Operator B912. Change callsign" [ref=e20]:
            - generic [ref=e24]: visitor
            - generic [ref=e25]: Operator B912
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
              - link "Bans" [ref=e43] [cursor=pointer]:
                - /url: /demo/admin/bans
            - listitem [ref=e44]:
              - link "Audit" [ref=e45] [cursor=pointer]:
                - /url: /demo/admin/audit
        - generic [ref=e46]:
          - heading "Live · Dashboard demo" [level=1] [ref=e47]
          - generic [ref=e48]:
            - generic [ref=e49]:
              - paragraph [ref=e50]:
                - generic [ref=e51]: On the test server now
                - generic [aria-hidden] [ref=e53]: ·
                - generic [ref=e54]: Wardogs Demo Server
              - heading "Bakurani" [level=2] [ref=e55]
              - generic [ref=e56]:
                - generic [ref=e57]:
                  - term [ref=e58]: Mode
                  - definition [ref=e59]: King of the Hill
                - generic [ref=e60]:
                  - term [ref=e61]: Light
                  - definition [ref=e62]: Day Clear
                - generic [ref=e63]:
                  - term [ref=e64]: Zone
                  - definition [ref=e65]: Small Factory
              - group "Scoreboard" [ref=e66]:
                - generic [ref=e67]:
                  - paragraph [ref=e68]: Lonestar
                  - paragraph [ref=e70]: "27"
                - generic [ref=e73]:
                  - paragraph [ref=e74]: Valkyra
                  - paragraph [ref=e76]: "37"
                - generic [ref=e79]:
                  - paragraph [ref=e80]: Manticore
                  - paragraph [ref=e82]: "69"
              - generic [ref=e85]:
                - generic [ref=e86]:
                  - paragraph [ref=e87]: Players
                  - paragraph [ref=e88]: 17/100
                - generic [ref=e91]:
                  - paragraph [ref=e92]: Match
                  - paragraph [ref=e93]: 24:32
                - generic [ref=e94]:
                  - paragraph [ref=e95]: Matches on record
                  - paragraph [ref=e96]: "108"
                - generic [ref=e97]:
                  - paragraph [ref=e98]: Roster
                  - paragraph [ref=e99]: "96"
            - group "Server actions" [ref=e100]:
              - button "Broadcast…" [ref=e101]
              - button "Override map…" [ref=e105]
              - button "Set lighting…" [ref=e108]
              - button "Restart match" [ref=e115]
              - button "End match" [ref=e121]
            - region [ref=e124]:
              - generic [ref=e126]:
                - heading "Players · 17" [level=2] [ref=e127]
                - paragraph [ref=e128]: Click a column to sort. The actions menu on each row sends the same RCON call a real console would.
              - table [ref=e130]:
                - caption [ref=e131]: Connected players
                - rowgroup [ref=e132]:
                  - row [ref=e133]:
                    - columnheader [ref=e134]:
                      - button "Callsign" [ref=e135]
                    - columnheader [ref=e136]:
                      - button "Faction" [ref=e137]
                    - columnheader [ref=e138]:
                      - button "Kills" [ref=e139]
                    - columnheader [ref=e142]:
                      - button "Deaths" [ref=e143]
                    - columnheader [ref=e144]:
                      - button "Ping" [ref=e145]
                    - columnheader "K/D" [ref=e146]
                    - columnheader "Cash" [ref=e147]
                    - columnheader "Session" [ref=e148]
                    - columnheader "Actions" [ref=e149]
                - rowgroup [ref=e151]:
                  - row [ref=e152]:
                    - cell "Fallo" [ref=e153]
                    - cell "Manticore" [ref=e157]
                    - cell "31" [ref=e158]
                    - cell "11" [ref=e159]
                    - cell "22 ms" [ref=e160]
                    - cell "2.82" [ref=e161]
                    - cell "$4,173" [ref=e162]
                    - cell "24m 21s" [ref=e163]
                    - cell [ref=e164]:
                      - button "Actions for Fallo" [ref=e166]
                  - row [ref=e171]:
                    - cell "Vanso" [ref=e172]
                    - cell "Valkyra" [ref=e176]
                    - cell "30" [ref=e177]
                    - cell "24" [ref=e178]
                    - cell "56 ms" [ref=e179]
                    - cell "1.25" [ref=e180]
                    - cell "$3,601" [ref=e181]
                    - cell "24m 31s" [ref=e182]
                    - cell [ref=e183]:
                      - button "Actions for Vanso" [ref=e185]
                  - row [ref=e190]:
                    - cell "Draur" [ref=e191]
                    - cell "Lonestar" [ref=e195]
                    - cell "30" [ref=e196]
                    - cell "18" [ref=e197]
                    - cell "54 ms" [ref=e198]
                    - cell "1.67" [ref=e199]
                    - cell "$3,811" [ref=e200]
                    - cell "24m 33s" [ref=e201]
                    - cell [ref=e202]:
                      - button "Actions for Draur" [ref=e204]
                  - row [ref=e209]:
                    - cell "Quenden49" [ref=e210]
                    - cell "Manticore" [ref=e214]
                    - cell "25" [ref=e215]
                    - cell "28" [ref=e216]
                    - cell "58 ms" [ref=e217]
                    - cell "0.89" [ref=e218]
                    - cell "$2,859" [ref=e219]
                    - cell "24m 25s" [ref=e220]
                    - cell [ref=e221]:
                      - button "Actions for Quenden49" [ref=e223]
                  - row [ref=e228]:
                    - cell "Falfir46" [ref=e229]
                    - cell "Lonestar" [ref=e233]
                    - cell "25" [ref=e234]
                    - cell "17" [ref=e235]
                    - cell "44 ms" [ref=e236]
                    - cell "1.47" [ref=e237]
                    - cell "$3,245" [ref=e238]
                    - cell "24m 28s" [ref=e239]
                    - cell [ref=e240]:
                      - button "Actions for Falfir46" [ref=e242]
                  - row [ref=e247]:
                    - cell "Yarpel36" [ref=e248]
                    - cell "Valkyra" [ref=e252]
                    - cell "23" [ref=e253]
                    - cell "17" [ref=e254]
                    - cell "81 ms" [ref=e255]
                    - cell "1.35" [ref=e256]
                    - cell "$3,005" [ref=e257]
                    - cell "24m 27s" [ref=e258]
                    - cell [ref=e259]:
                      - button "Actions for Yarpel36" [ref=e261]
                  - row [ref=e266]:
                    - cell "Wolyx64" [ref=e267]
                    - cell "Lonestar" [ref=e271]
                    - cell "23" [ref=e272]
                    - cell "25" [ref=e273]
                    - cell "25 ms" [ref=e274]
                    - cell "0.92" [ref=e275]
                    - cell "$2,722" [ref=e276]
                    - cell "24m 19s" [ref=e277]
                    - cell [ref=e278]:
                      - button "Actions for Wolyx64" [ref=e280]
                  - row [ref=e285]:
                    - cell "Junvik94" [ref=e286]
                    - cell "Manticore" [ref=e290]
                    - cell "23" [ref=e291]
                    - cell "11" [ref=e292]
                    - cell "22 ms" [ref=e293]
                    - cell "2.09" [ref=e294]
                    - cell "$3,211" [ref=e295]
                    - cell "24m 16s" [ref=e296]
                    - cell [ref=e297]:
                      - button "Actions for Junvik94" [ref=e299]
                  - row [ref=e304]:
                    - cell "Dunrick" [ref=e305]
                    - cell "Lonestar" [ref=e309]
                    - cell "19" [ref=e310]
                    - cell "22" [ref=e311]
                    - cell "81 ms" [ref=e312]
                    - cell "0.86" [ref=e313]
                    - cell "$2,243" [ref=e314]
                    - cell "18m 31s" [ref=e315]
                    - cell [ref=e316]:
                      - button "Actions for Dunrick" [ref=e318]
                  - row [ref=e323]:
                    - cell "Esktan" [ref=e324]
                    - cell "Valkyra" [ref=e328]
                    - cell "16" [ref=e329]
                    - cell "7" [ref=e330]
                    - cell "76 ms" [ref=e331]
                    - cell "2.29" [ref=e332]
                    - cell "$2,404" [ref=e333]
                    - cell "18m 18s" [ref=e334]
                    - cell [ref=e335]:
                      - button "Actions for Esktan" [ref=e337]
                  - row [ref=e342]:
                    - cell "Stiren" [ref=e343]
                    - cell "Lonestar" [ref=e347]
                    - cell "13" [ref=e348]
                    - cell "17" [ref=e349]
                    - cell "57 ms" [ref=e350]
                    - cell "0.76" [ref=e351]
                    - cell "$1,801" [ref=e352]
                    - cell "24m 15s" [ref=e353]
                    - cell [ref=e354]:
                      - button "Actions for Stiren" [ref=e356]
                  - row [ref=e361]:
                    - cell "Quendor16" [ref=e362]
                    - cell "Valkyra" [ref=e366]
                    - cell "13" [ref=e367]
                    - cell "27" [ref=e368]
                    - cell "143 ms" [ref=e369]
                    - cell "0.48" [ref=e370]
                    - cell "$1,452" [ref=e371]
                    - cell "24m 18s" [ref=e372]
                    - cell [ref=e373]:
                      - button "Actions for Quendor16" [ref=e375]
                  - row [ref=e380]:
                    - cell "Uleth" [ref=e381]
                    - cell "Valkyra" [ref=e385]
                    - cell "8" [ref=e386]
                    - cell "3" [ref=e387]
                    - cell "22 ms" [ref=e388]
                    - cell "2.67" [ref=e389]
                    - cell "$1,384" [ref=e390]
                    - cell "7m 12s" [ref=e391]
                    - cell [ref=e392]:
                      - button "Actions for Uleth" [ref=e394]
                  - row [ref=e399]:
                    - cell "Stibo" [ref=e400]
                    - cell "Valkyra" [ref=e404]
                    - cell "8" [ref=e405]
                    - cell "20" [ref=e406]
                    - cell "81 ms" [ref=e407]
                    - cell "0.40" [ref=e408]
                    - cell "$1,098" [ref=e409]
                    - cell "24m 22s" [ref=e410]
                    - cell [ref=e411]:
                      - button "Actions for Stibo" [ref=e413]
                  - row [ref=e418]:
                    - cell "Lomsen" [ref=e419]
                    - cell "Manticore" [ref=e423]
                    - cell "8" [ref=e424]
                    - cell "7" [ref=e425]
                    - cell "22 ms" [ref=e426]
                    - cell "1.14" [ref=e427]
                    - cell "$1,555" [ref=e428]
                    - cell "24m 30s" [ref=e429]
                    - cell [ref=e430]:
                      - button "Actions for Lomsen" [ref=e432]
                  - row [ref=e437]:
                    - cell "Ozos" [ref=e438]
                    - cell "Manticore" [ref=e442]
                    - cell "6" [ref=e443]
                    - cell "2" [ref=e444]
                    - cell "103 ms" [ref=e445]
                    - cell "3.00" [ref=e446]
                    - cell "$1,204" [ref=e447]
                    - cell "8m 34s" [ref=e448]
                    - cell [ref=e449]:
                      - button "Actions for Ozos" [ref=e451]
                  - row [ref=e456]:
                    - cell "Wolta" [ref=e457]
                    - cell "Manticore" [ref=e461]
                    - cell "4" [ref=e462]
                    - cell "6" [ref=e463]
                    - cell "113 ms" [ref=e464]
                    - cell "0.67" [ref=e465]
                    - cell "$833" [ref=e466]
                    - cell "9m 05s" [ref=e467]
                    - cell [ref=e468]:
                      - button "Actions for Wolta" [ref=e470]
          - region [ref=e475]:
            - generic [ref=e476]:
              - heading "What this sends" [level=2] [ref=e477]
              - button "Close" [ref=e478]
            - generic [ref=e483]:
              - generic [ref=e484]:
                - generic [ref=e485]: POST
                - code [ref=e486]: /v1/players/76561198731609860/kick
              - paragraph [ref=e487]: Kick a player · Kornex73 · "team killing"
              - generic [ref=e488]:
                - paragraph [ref=e489]: Body
                - generic [ref=e490]: "{ \"reason\": \"team killing\" }"
              - generic [ref=e491]:
                - tablist "Copy as" [ref=e492]:
                  - tab "curl" [selected] [ref=e493]
                  - tab "fetch" [ref=e494]
                  - tab "PowerShell" [ref=e495]
                - tabpanel "curl" [ref=e496]:
                  - generic [ref=e497]: "curl -X POST 'https://your-server-host:7776/v1/players/76561198731609860/kick' \\ -H 'Authorization: Bearer <token>' \\ -H 'Content-Type: application/json' \\ --data-raw '{ \"reason\": \"team killing\" }'"
                  - button "Copy as curl" [ref=e498]
              - paragraph [ref=e503]:
                - text: Sent to the in-browser simulator.
                - link "Point the API console at your own server to run it for real." [ref=e504] [cursor=pointer]:
                  - /url: /rcon-api?endpoint=post-v1-players-steamId-kick
              - generic [ref=e505]:
                - checkbox "Don't show automatically" [ref=e506]
                - text: Don't show automatically
  - generic [ref=e507]:
    - paragraph [ref=e508]: Kornex73 kicked. They can come back in a few minutes.
    - button "Dismiss" [ref=e509]
  - generic [ref=e513]: Kornex73 kicked. They can come back in a few minutes.
  - alert [ref=e514]
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
> 39  |     await expect(sheet.getByText("POST")).toBeVisible();
      |                                           ^ Error: expect(locator).toBeVisible() failed
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