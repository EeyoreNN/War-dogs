// §7.2 spec 2 — the war room: /create → /room/[code], draw, marker, rename, undo / redo, reload
// persistence, COPY LINK, LOCAL pill. Desktop project.
import { expect, test, type Page } from "@playwright/test";

// These journeys are LOCAL by contract: opt out of any relay the build was configured with
// (`wardogs:relay = "off"`, §5.2) before the first page script runs.
test.beforeEach(({ context }) =>
  context.addInitScript(() => localStorage.setItem("wardogs:relay", "off")),
);
test.skip(({ isMobile }) => !!isMobile, "desktop only");

const map = (page: Page) => page.getByRole("application");
const markers = (page: Page) => page.locator('[data-node-type="marker"]');
const strokes = (page: Page) => page.locator('[data-node-type="stroke"]');

test("create a room, draw, place and rename a marker, undo / redo, reload, copy link", async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/create");
  await page.getByRole("radio", { name: "Valkyra" }).click();
  await page.getByRole("radio", { name: /^Bakurani/ }).click();
  await page.getByRole("radio", { name: "Houses" }).click();
  await page.getByLabel(/type your callsign/i).fill("Reaper");
  await page.getByRole("button", { name: /open war room/i }).click();
  await page.waitForURL(/\/room\/[A-HJ-NP-Z2-9]{6}$/);
  const code = page.url().match(/\/room\/([A-HJ-NP-Z2-9]{6})/)![1];

  await expect(map(page)).toBeVisible();
  await expect(page.getByTestId("sync-pill")).toContainText(/LOCAL/i);
  await expect(page.locator("[data-topbar]")).toContainText(/Bakurani · Houses/i);
  await expect(page.locator("[data-topbar]")).toContainText("CMD");

  // Pen stroke with the mouse.
  const box = (await map(page).boundingBox())!;
  const at = (x: number, y: number) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  await page.keyboard.press("p");
  const start = at(0.3, 0.3);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++)
    await page.mouse.move(start.x + i * 8, start.y + Math.sin(i / 3) * 20);
  await page.mouse.up();
  await expect(strokes(page)).toHaveCount(1);

  // Marker via `2` + click, then rename it (V, Enter opens the inline editor).
  await map(page).focus();
  await page.keyboard.press("2");
  const p = at(0.55, 0.45);
  await page.mouse.click(p.x, p.y);
  await expect(markers(page)).toHaveCount(1);
  await map(page).focus();
  await page.keyboard.press("v");
  await page.keyboard.press("Enter");
  const editor = page.getByLabel("Marker label");
  await expect(editor).toBeVisible();
  await editor.fill("RALLY NORTH");
  await page.keyboard.press("Enter");
  await expect(markers(page).first()).toContainText("RALLY NORTH");

  // Undo restores the old label; redo brings the rename back.
  await page.keyboard.press("Control+z");
  await expect(markers(page).first()).not.toContainText("RALLY NORTH");
  await page.keyboard.press("Control+Shift+z");
  await expect(markers(page).first()).toContainText("RALLY NORTH");

  // Reload → everything persists (debounced save is 500 ms).
  await page.waitForTimeout(800);
  await page.reload();
  await expect(map(page)).toBeVisible();
  await expect(markers(page)).toHaveCount(1);
  await expect(strokes(page)).toHaveCount(1);
  await expect(markers(page).first()).toContainText("RALLY NORTH");

  // COPY LINK writes `${site.url}/join?code=CODE` to the clipboard.
  await page
    .locator("[data-topbar]")
    .getByRole("button", { name: /copy link/i })
    .click();
  await expect(page.locator("[data-topbar]")).toContainText(/copied/i);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain(`/join?code=${code}`);
  expect(clip.startsWith(baseURL ?? "")).toBe(true);
});

test("raise, claim and deliver a request; the map export contract holds", async ({ page }) => {
  await page.goto("/create");
  await page.getByLabel(/type your callsign/i).fill("Boston");
  await page.getByRole("button", { name: /open war room/i }).click();
  await page.waitForURL(/\/room\//);
  await expect(map(page)).toBeVisible();

  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: /new request/i });
  await dialog.getByRole("radio", { name: /^medical/i }).click();
  await dialog.getByRole("radio", { name: /urgent/i }).click();
  await dialog.getByRole("button", { name: /place on map/i }).click();
  const box = (await map(page).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const card = page
    .getByRole("listitem")
    .filter({ hasText: /medical/i })
    .first();
  await expect(card).toContainText(/urgent/i);
  await expect(page.locator("svg [data-request-id]")).toHaveCount(1);
  await card.getByRole("button", { name: /^claim$/i }).click();
  await expect(card).toContainText(/claimed by Boston/i);
  await card
    .getByRole("group", { name: /set eta/i })
    .getByRole("button", { name: "1m" })
    .click();
  await expect(card).toContainText(/ETA/);
  await card.getByRole("button", { name: /^delivered$/i }).click();
  await page.getByRole("tab", { name: /done/i }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: /medical/i })
      .first(),
  ).toContainText(/delivered/i);

  // Every shape inside the map SVG carries presentation attributes, never a class (§4.3.2).
  const offenders = await page.evaluate(() => {
    const svg = document.getElementById("map")!;
    return svg.querySelectorAll(
      "path[class], circle[class], rect[class], line[class], polygon[class], text[class], use[class]",
    ).length;
  });
  expect(offenders).toBe(0);
});
