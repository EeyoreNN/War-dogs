// §7.2 spec 4 — the live demo on a faked clock: seed visible at once, bots act on the shared
// timeline, the epoch rolls, `Clear mine` removes only mine, the desktop bar / mobile chip.
import { expect, test, type Page } from "@playwright/test";

// These journeys are LOCAL by contract: opt out of any relay the build was configured with
// (`wardogs:relay = "off"`, §5.2) before the first page script runs.
test.beforeEach(({ context }) =>
  context.addInitScript(() => localStorage.setItem("wardogs:relay", "off")),
);
const EPOCH_MS = 300_000;
// Scoped to the live map: the server shell keeps its own (hidden) copy of the seed plan (§3.13).
const markers = (page: Page) => page.getByRole("application").locator('[data-node-type="marker"]');
const pins = (page: Page) => page.getByRole("application").locator("[data-request-id]");

test("seed plan, scripted bots, epoch roll and Clear mine", async ({ page, isMobile }) => {
  // A fixed epoch start well away from a boundary; installed BEFORE navigation (§4.2).
  const epochStart = Math.floor(Date.now() / EPOCH_MS) * EPOCH_MS + EPOCH_MS * 3;
  await page.clock.install({ time: epochStart });
  await page.goto("/demo");

  // The server shell already paints the seed plan; the live app then takes over in place.
  const map = page.getByRole("application");
  await expect(map).toBeVisible();
  await expect
    .poll(async () => (await markers(page).count()) + (await pins(page).count()))
    .toBeGreaterThanOrEqual(8);
  await expect(page.locator("[data-app-shell]")).toBeHidden();

  if (!isMobile) {
    const roster = page.getByRole("list", { name: /^roster$/i });
    for (const bot of ["Ossian", "Krieger", "Boston", "Rook"])
      await expect(roster).toContainText(bot);
    await expect(roster).toContainText("(you)");
    await expect(page.getByRole("link", { name: /open your own war room/i })).toHaveAttribute(
      "href",
      /\/create\?map=zestafona/,
    );
  } else {
    const chip = page.getByRole("link", { name: /open yours/i });
    await expect(chip).toBeVisible();
    await page.getByRole("button", { name: /^dismiss$/i }).click();
    await expect(chip).toBeHidden();
  }

  // The visitor places a marker; at 45 s Krieger has delivered Fuel.
  await map.focus();
  await page.keyboard.press("2");
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  const seedMarkers = 7;
  await expect(markers(page)).toHaveCount(seedMarkers + 1); // ours now; the bot's troops come at 14 s
  await page.clock.runFor(46_000);
  if (!isMobile) {
    await page.getByRole("tab", { name: /done/i }).click();
    await expect(page.getByRole("listitem").filter({ hasText: /fuel/i }).first()).toContainText(
      /delivered/i,
    );
    await page.getByRole("tab", { name: /^all$/i }).click();
  }
  await expect(markers(page)).toHaveCount(seedMarkers + 1 + 1); // troops marker from the timeline + ours

  // Clear mine removes only the visitor's marker.
  if (isMobile) {
    await page.getByRole("button", { name: /^more$/i }).click();
    await page.getByRole("button", { name: /clear mine/i }).click();
  } else {
    await page.getByRole("button", { name: /clear mine/i }).click();
  }
  await expect(markers(page)).toHaveCount(seedMarkers + 1);

  // Roll to the next epoch: a fresh seed, the bot's troops marker gone with everything else.
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await expect(markers(page)).toHaveCount(seedMarkers + 2);
  await page.clock.runFor(EPOCH_MS - 46_000 + 2_000);
  await expect(markers(page)).toHaveCount(seedMarkers);
  await expect(page.getByTestId("sync-pill")).toBeVisible();
});
