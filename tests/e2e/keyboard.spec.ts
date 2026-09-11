// §7.2 spec 6 — keyboard paths: toolbar, tools by letter, marker at the crosshair, the node list,
// Delete, the help dialog with `?` and Esc returning focus.
import { expect, test } from "@playwright/test";

test.skip(({ isMobile }) => !!isMobile, "desktop only");

test("draw and manage the map with the keyboard alone", async ({ page }) => {
  await page.goto("/create");
  await page.getByLabel(/type your callsign/i).fill("Krieger");
  await page.getByRole("button", { name: /open war room/i }).click();
  await page.waitForURL(/\/room\//);
  const map = page.getByRole("application");
  await expect(map).toBeVisible();

  // Tab to the toolbar (roving tabindex): the first tool is the tab stop.
  await page.locator('[role="toolbar"][aria-label="Drawing tools"] [data-tool="select"]').focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[data-tool="pen"]')).toBeFocused();
  await page.keyboard.press("p");
  await expect(page.locator('[data-tool="pen"]')).toHaveAttribute("aria-pressed", "true");

  // Focus the map, `1` selects the FOB marker, Enter places it at the crosshair.
  await map.focus();
  await page.keyboard.press("1");
  await expect(page.locator('[data-marker="fob"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-node-type="marker"]')).toHaveCount(1);

  // Tab moves to the node list; Delete removes the selected marker.
  await map.focus();
  await page.keyboard.press("Tab");
  const list = page.getByRole("listbox", { name: /things on the map/i });
  await expect(list).toBeVisible();
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option").first()).toContainText(/Friendly FOB/);
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-node-type="marker"]')).toHaveCount(0);

  // `?` opens Controls & help; Esc closes it and focus returns.
  await map.focus();
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: /controls & help/i });
  await expect(help).toBeVisible();
  await expect(help).toContainText("new request");
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
  await expect(map).toBeFocused();
});
