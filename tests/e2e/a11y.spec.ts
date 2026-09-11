import { expect, test, type Page } from "@playwright/test";
import { auditPage } from "../../src/lib/a11y/audit";

const ROUTES = [
  "/",
  "/add",
  "/terms",
  "/privacy",
  "/this-does-not-exist",
  "/demo",
  "/create",
  "/join",
  "/dev",
  "/rcon-reference",
  "/rcon-api",
  "/discord-help",
  "/map-guide",
  "/demo/admin",
  "/demo/admin/live",
  "/room/ABC234",
];

/**
 * Structural accessibility audit run inside the page (§7.2 #10) through WP3's self-contained
 * `auditPage` (buttons and links without accessible names, inputs without labels, images without
 * alt, duplicate ids, missing `main`, `h1` count ≠ 1, positive tabindex).
 */
async function audit(page: Page, path: string) {
  // `load`, not `networkidle`: app routes keep long-lived connections, and the audit reads the
  // server-rendered structure (§7.2 #10), not network state.
  await page.goto(path, { waitUntil: "load" });
  return page.evaluate(auditPage);
}

test.describe("a11y", () => {
  for (const path of ROUTES) {
    test(`structural audit ${path}`, async ({ page }) => {
      const issues = await audit(page, path);
      expect(issues, path).toEqual([]);
    });
  }

  test("skip link reaches #main on the home page", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("#main")).toBeVisible();
  });

  test("every focusable element on the home page shows a focus ring", async ({ page }) => {
    await page.goto("/");
    const missing = await page.evaluate(() => {
      const out: string[] = [];
      const els = document.querySelectorAll<HTMLElement>(
        "a[href], button, input, [tabindex='0'], summary",
      );
      for (const el of els) {
        el.focus({ preventScroll: true });
        if (document.activeElement !== el) continue;
        const cs = getComputedStyle(el);
        if (cs.outlineStyle === "none" && !cs.boxShadow.includes("rgb")) {
          out.push(`${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 24)}`);
        }
      }
      return out;
    });
    expect(missing).toEqual([]);
  });
});
