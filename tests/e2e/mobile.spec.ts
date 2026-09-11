// §7.2 spec 5 — the phone layout (Pixel 7 project): join → room, bottom bar, sheet, FABs, no
// horizontal scroll anywhere, ≥ 44 px targets on the bottom bar.
import { expect, test } from "@playwright/test";

// These journeys are LOCAL by contract: opt out of any relay the build was configured with
// (`wardogs:relay = "off"`, §5.2) before the first page script runs.
test.beforeEach(({ context }) =>
  context.addInitScript(() => localStorage.setItem("wardogs:relay", "off")),
);
test.skip(({ isMobile }) => !isMobile, "mobile only");

test("join a room from a phone and use the bottom bar, FABs and sheet", async ({ page }) => {
  await page.goto("/join?code=ABC234");
  await page.getByLabel(/type your callsign/i).fill("Rook");
  await page.getByRole("button", { name: /join war room/i }).click();
  await page.waitForURL(/\/room\/ABC234/);

  // Unknown room on this device → "Nothing here yet" → start fresh (§4.3.9).
  const empty = page.getByRole("dialog", { name: /nothing here yet/i });
  await expect(empty).toBeVisible();
  await empty.getByRole("button", { name: /start a fresh plan/i }).click();

  const map = page.getByRole("application");
  await expect(map).toBeVisible();
  await expect(page.locator("[data-mobile-bar]")).toBeVisible();
  await expect(page.locator("[data-rail]")).toHaveCount(0);
  const heights = await page
    .locator("[data-mobile-bar] button")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);

  // Request FAB → Fuel → place → card in the sheet.
  await page.getByTestId("fab-request").click();
  const dialog = page.getByRole("dialog", { name: /new request/i });
  await dialog.getByRole("radio", { name: /^fuel/i }).click();
  await dialog.getByRole("button", { name: /place on map/i }).click();
  const box = (await map.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.locator("svg [data-request-id]")).toHaveCount(1);
  await page.locator("[data-panels-sheet] button").first().click();
  await expect(page.getByRole("listitem").filter({ hasText: /fuel/i }).first()).toBeVisible();
  await page.locator("[data-panels-sheet] button").first().click();
  await page.locator("[data-panels-sheet] button").first().click();

  // Ping FAB + tap → ring.
  await page.getByTestId("fab-ping").click();
  await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await expect(page.locator("[data-ping]")).toHaveCount(1);
});

test("no horizontal scroll on any route", async ({ page }) => {
  for (const url of ["/", "/demo", "/create", "/join", "/dev", "/rcon-reference", "/demo/admin"]) {
    const res = await page.goto(url);
    if (!res || res.status() >= 400) continue;
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(ok, `horizontal scroll on ${url}`).toBe(true);
  }
});
