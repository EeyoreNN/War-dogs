import { expect, test, type Page } from "@playwright/test";

/**
 * Structural accessibility audit run inside the page (§7.2 #10): buttons and links without
 * accessible names, inputs without labels, images without alt, duplicate ids, missing `main`,
 * `h1` count ≠ 1, positive tabindex. Self-contained so the spec has no cross-package import;
 * the integrated build can swap in `src/lib/a11y/audit.ts` (`auditPage()`) once WP3 lands.
 */
function auditInPage(): string[] {
  const issues: string[] = [];
  const name = (el: Element) => {
    const aria = el.getAttribute("aria-label") ?? "";
    const labelled = el.getAttribute("aria-labelledby");
    const byId = labelled
      ? labelled
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
      : "";
    const title = el.getAttribute("title") ?? "";
    const imgAlt = [...el.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt")).join(" ");
    return `${aria} ${byId} ${title} ${imgAlt} ${el.textContent ?? ""}`.trim();
  };
  const describe = (el: Element) =>
    `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : ""}`;

  for (const el of document.querySelectorAll("button, a[href], [role=button], [role=link]")) {
    if (!name(el)) issues.push(`no accessible name: ${describe(el)}`);
  }
  for (const el of document.querySelectorAll<HTMLInputElement>(
    "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea",
  )) {
    const hasLabel =
      el.getAttribute("aria-label") ||
      el.getAttribute("aria-labelledby") ||
      (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
      el.closest("label");
    if (!hasLabel) issues.push(`input without label: ${describe(el)}`);
  }
  for (const el of document.querySelectorAll("img")) {
    if (!el.hasAttribute("alt")) issues.push(`img without alt: ${el.getAttribute("src")}`);
  }
  const ids = new Map<string, number>();
  for (const el of document.querySelectorAll("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) issues.push(`duplicate id: ${id} (${n})`);
  if (!document.querySelector("main")) issues.push("missing <main>");
  const h1s = document.querySelectorAll("h1").length;
  if (h1s !== 1) issues.push(`h1 count is ${h1s}`);
  for (const el of document.querySelectorAll("[tabindex]")) {
    if (Number(el.getAttribute("tabindex")) > 0) issues.push(`positive tabindex: ${describe(el)}`);
  }
  return issues;
}

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

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  return page.evaluate(auditInPage);
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
