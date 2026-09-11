import { expect, test, type Page } from "@playwright/test";

/** LCP / CLS via PerformanceObserver; soft annotations, hard failure only past 4000 ms / 0.25 (§7.2). */
async function readVitals(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number; lcpTag: string }>((resolve) => {
        let lcp = 0;
        let lcpTag = "";
        let cls = 0;
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as (PerformanceEntry & { element?: Element })[]) {
              lcp = e.startTime;
              lcpTag = e.element
                ? `${e.element.tagName}${e.element.id ? "#" + e.element.id : ""}`
                : "";
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as (PerformanceEntry & {
              hadRecentInput?: boolean;
              value?: number;
            })[]) {
              if (!e.hadRecentInput) cls += e.value ?? 0;
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch {
          /* unsupported: report zeros */
        }
        setTimeout(() => resolve({ lcp, cls, lcpTag }), 1200);
      }),
  );
}

test.describe("home", () => {
  test("hero copy, CTAs and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The tactical map for your Wardogs Discord",
    );
    await expect(
      page.getByText("Open it in a voice channel. Everyone in the call draws on the same map."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open a war room" })).toHaveAttribute(
      "href",
      "/create",
    );
    await expect(page.getByRole("link", { name: "Join a war room" })).toHaveAttribute(
      "href",
      "/join",
    );
    await expect(page.getByRole("link", { name: /Not an admin\?/ })).toHaveAttribute(
      "href",
      "/add?to=account",
    );
    await expect(page.getByRole("heading", { name: "Three clicks to a shared map" })).toBeVisible();
    await expect(page.getByRole("link", { name: /The live demo/ })).toHaveAttribute(
      "href",
      "/demo",
    );

    const vitals = await readVitals(page);
    test
      .info()
      .annotations.push(
        { type: "LCP", description: `${Math.round(vitals.lcp)} ms (${vitals.lcpTag})` },
        { type: "CLS", description: vitals.cls.toFixed(3) },
      );
    expect(vitals.lcp).toBeLessThan(4000);
    expect(vitals.cls).toBeLessThan(0.25);
    expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
  });

  test("OG image route responds with a PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("FAQ disclosures toggle", async ({ page }) => {
    await page.goto("/");
    const first = page.locator("details").first();
    const summary = first.locator("summary");
    await expect(first).not.toHaveAttribute("open", "");
    await summary.click();
    await expect(first).toHaveAttribute("open", "");
    await expect(first.getByText(/One admin adds it to the server once/)).toBeVisible();
    await summary.click();
    await expect(first).not.toHaveAttribute("open", "");
  });

  test("code field routes a valid code, DEMO and rejects a bad one", async ({ page }) => {
    await page.goto("/");
    const field = page.getByRole("textbox", { name: "War room code" });
    await field.fill("abc234");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/room\/ABC234$/);

    await page.goto("/");
    await field.fill("demo");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/demo$/);

    await page.goto("/");
    await field.fill("ab0");
    await field.press("Enter");
    // The field's own error element, not Next's route announcer (also role=alert).
    const error = page.locator("#hero-code-error");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveText("Codes are 6 letters or digits, never 0, O, 1 or I.");
    await expect(field).toHaveAttribute("aria-describedby", "hero-code-error");
    await expect(page).toHaveURL(/\/$/);
  });

  test("rejoin card lists recent rooms and forgets one", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "wardogs:rooms",
        JSON.stringify([
          {
            code: "X5GM4Q",
            team: "Lonestar",
            map: "zestafona",
            controlZone: "default",
            role: "commander",
            updatedAt: Date.now() - 12 * 60_000,
          },
        ]),
      );
    });
    await page.goto("/");
    const row = page.getByRole("link", { name: /X5GM4Q/ });
    await expect(row).toHaveAttribute("href", "/room/X5GM4Q");
    await expect(row).toContainText("12 min ago");
    await page.getByRole("button", { name: "Forget X5GM4Q" }).click();
    await expect(row).toHaveCount(0);
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const [sw, iw] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(sw).toBeLessThanOrEqual(iw);
  });
});
