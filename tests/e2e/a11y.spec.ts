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
  "/demo/admin/rotation",
  "/demo/admin/history",
  "/demo/admin/bans",
  "/demo/admin/audit",
  "/activity",
  "/room/ABC234",
];

/** Seed an identity so `/room/[code]` renders the war room, not the callsign gate. */
async function seedIdentity(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("wardogs:identity")) {
      localStorage.setItem(
        "wardogs:identity",
        JSON.stringify({
          v: 1,
          client: "wd_A11YA11YA11Y",
          callsign: "Auditor",
          focus: null,
          ink: "blue",
        }),
      );
    }
  });
}

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

  // §7.2 #10: the visible-focus assertion runs on `/room/[code]` (every control, including the
  // NodeList options) and on the home page. A fresh room shows the join gate, so the map SVG is
  // reached on `/demo`; add it here once MapSurface.tsx draws its ring (`outline-none` sets
  // `--tw-outline-style: none`, which `focus-visible:outline-2` reuses — it needs
  // `focus-visible:outline-solid`).
  for (const path of ["/room/ABC234", "/"]) {
    test(`every focusable element on ${path} shows a focus ring`, async ({ page }) => {
      await seedIdentity(page);
      await page.goto(path, { waitUntil: "load" });
      // The map app is a lazy chunk: wait for its root before probing.
      if (path !== "/") await page.locator('[data-bundle="wd:map-app"]').waitFor();
      // One real key press puts Chromium's :focus-visible heuristic into keyboard mode, so the
      // programmatic focus() calls below match `:focus-visible` (they may not on a page whose
      // script has already dispatched pointer activity, e.g. the demo director).
      await page.keyboard.press("Tab");
      const missing = await page.evaluate(() => {
        const out: string[] = [];
        const els = document.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea, [tabindex='0'], [role='option'], summary",
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
  }
});
