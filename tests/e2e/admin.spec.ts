import { expect, test, type Page } from "@playwright/test";

/*
 * §7.2 spec 7: /demo/admin/live → kick a player (reason) → row disappears → audit shows `you`
 * → run the clock 300 s → the player returns; ban → Bans tab shows a countdown; the
 * "What this sends" sheet shows `POST /v1/players/{steamId}/kick`.
 */

const EPOCH = Date.UTC(2026, 8, 11, 13, 4, 31); // a fixed instant so the roster is deterministic

async function openLive(page: Page) {
  await page.clock.install({ time: EPOCH });
  await page.goto("/demo/admin/live");
  await expect(page.getByTestId("live-server-card")).toBeVisible();
  await expect(page.getByTestId("players-table")).toBeVisible();
}

test.describe("admin dashboard", () => {
  test("kick a player: row disappears, audit says you, they return within 300 s, sheet shows the call", async ({
    page,
  }) => {
    await openLive(page);
    const row = page.getByTestId("players-table").locator("tbody tr").first();
    const steamId = await row.getAttribute("data-steamid");
    const name = (await row.locator("td").first().innerText()).trim().split("\n")[0];
    expect(steamId).toMatch(/^\d{17}$/);

    await row.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Kick…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Reason/).fill("team killing");
    await dialog.getByRole("button", { name: "Kick", exact: true }).click();

    await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(0);

    // The "What this sends" sheet opened automatically with the exact RCON call.
    const sheet = page.getByRole("region", { name: "What this sends" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("POST", { exact: true })).toBeVisible();
    await expect(sheet.getByText(`/v1/players/${steamId}/kick`, { exact: true })).toBeVisible();
    await expect(sheet.getByTestId("sheet-snippet-curl")).toContainText("Authorization: Bearer");
    await sheet.getByRole("button", { name: "Close" }).click();

    // Audit shows the row under the visitor with the `you` badge.
    await page
      .getByRole("navigation", { name: "Dashboard" })
      .getByRole("link", { name: "Audit" })
      .click();
    const mine = page.locator('[data-testid="audit-row"][data-mine="true"]').first();
    await expect(mine).toContainText("kick");
    await expect(mine).toContainText(name);
    await expect(mine).toContainText('"team killing"');
    await expect(mine.getByText("you", { exact: true })).toBeVisible();

    // Kicked players come back on their own within 90–300 s.
    await page
      .getByRole("navigation", { name: "Dashboard" })
      .getByRole("link", { name: "Live" })
      .click();
    await page.clock.runFor(300_000);
    await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(1);
  });

  test("ban a player: the Bans tab shows a live countdown and Unban lifts it", async ({ page }) => {
    await openLive(page);
    const row = page.getByTestId("players-table").locator("tbody tr").nth(1);
    const steamId = await row.getAttribute("data-steamid");
    const name = (await row.locator("td").first().innerText()).trim().split("\n")[0];

    await row.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Ban…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Reason/).fill("cheating");
    await dialog.getByLabel(/Evidence URL/).fill("https://example.test/clip");
    await dialog.getByRole("button", { name: "Ban for 1h" }).click();
    await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(0);
    const sheet = page.getByRole("region", { name: "What this sends" });
    await expect(sheet.getByText("/v1/bans", { exact: true })).toBeVisible();

    // The sheet belongs to the Live tab: on a wide viewport switching tabs must not leave it
    // over the Bans table. On a phone it is (almost) full width and covers the nav, so close it.
    const wide = (page.viewportSize()?.width ?? 0) >= 1024;
    if (!wide) await sheet.getByRole("button", { name: "Close" }).click();
    await page
      .getByRole("navigation", { name: "Dashboard" })
      .getByRole("link", { name: "Bans" })
      .click();
    await expect(sheet).toBeHidden();
    const banRow = page.locator(`[data-testid="bans-table"] tr[data-steamid="${steamId}"]`);
    await expect(banRow).toBeVisible();
    await expect(banRow.getByTestId("ban-countdown")).toHaveText(/59m|1h 00m/);
    await page.clock.runFor(120_000);
    await expect(banRow.getByTestId("ban-countdown")).toHaveText(/5[6-8]m/);
    await banRow.getByRole("button", { name: "Unban" }).click();
    await expect(banRow).toHaveCount(0);
  });

  test("landing page hero, live card and no horizontal scroll", async ({ page }) => {
    await page.goto("/demo/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Run a Wardogs server from one dashboard",
    );
    await expect(page.getByTestId("live-server-card")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the dashboard/ }).first()).toHaveAttribute(
      "href",
      "/demo/admin/live",
    );
    const [sw, iw] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(sw).toBeLessThanOrEqual(iw);
  });
});
