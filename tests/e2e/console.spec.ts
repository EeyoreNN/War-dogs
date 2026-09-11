import { expect, test } from "@playwright/test";

/*
 * §7.2 spec 8: /rcon-api search `status` → select → Send (simulator) → 200 with `serverName`;
 * Copy as curl contains `Authorization: Bearer`. The /rcon-api page lands in Phase 2 on WP5's
 * DocsShell; this spec runs against the integrated build.
 */

test.describe("API console", () => {
  test("search status, send to the simulator, copy as curl", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/rcon-api");
    await expect(page.getByTestId("api-console")).toBeVisible();

    await page.getByRole("searchbox", { name: "Search endpoints" }).fill("status");
    const nav = page.getByRole("navigation", { name: "Endpoints" });
    await expect(nav.getByRole("button")).toHaveCount(1);
    await nav.getByRole("button").click();
    await expect(page.getByRole("heading", { name: "Live match state" })).toBeVisible();

    await page.getByTestId("console-send").click();
    await expect(page.getByTestId("response-status")).toContainText("200");
    await expect(page.getByTestId("response-body")).toContainText("serverName");

    await expect(page.getByTestId("snippet-curl")).toContainText("Authorization: Bearer");
    await page.getByRole("button", { name: "Copy as curl" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Authorization: Bearer");
    expect(copied).toContain("/v1/status");
  });

  test("deep link selects the endpoint and a kick lands on the dashboard", async ({ page }) => {
    await page.goto("/rcon-api?endpoint=post-v1-players-steamId-kick");
    await expect(page.getByRole("heading", { name: "Kick a player" })).toBeVisible();
    await expect(page.getByTestId("console-send")).toBeDisabled();

    // Borrow a steamId from the live roster, then kick it from the console.
    await page.goto("/demo/admin/live");
    const steamId = await page
      .getByTestId("players-table")
      .locator("tbody tr")
      .first()
      .getAttribute("data-steamid");
    await page.goto(`/rcon-api?endpoint=post-v1-players-steamId-kick`);
    await page.getByLabel(/steamId · path/).fill(steamId!);
    await page.getByTestId("console-send").click();
    await expect(page.getByTestId("response-status")).toContainText("200");

    await page.goto("/demo/admin/live");
    await expect(page.getByTestId("players-table")).toBeVisible();
    await expect(page.locator(`tr[data-steamid="${steamId}"]`)).toHaveCount(0);
  });

  test("your server mode keeps the target in this tab only and explains CORS", async ({ page }) => {
    await page.goto("/rcon-api");
    await page.getByRole("radio", { name: "Your server" }).click();
    await page.getByLabel("Base URL").fill("https://127.0.0.1:1");
    await expect(page.getByText(/must answer CORS preflights/)).toBeVisible();
    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByText(/No answer from https:\/\/127\.0\.0\.1:1/)).toBeVisible({
      timeout: 15_000,
    });
    const stored = await page.evaluate(() => [
      sessionStorage.getItem("wardogs:console:target"),
      localStorage.getItem("wardogs:console:target"),
    ]);
    expect(stored[0]).toContain("https://127.0.0.1:1");
    expect(stored[1]).toBeNull();
  });
});
