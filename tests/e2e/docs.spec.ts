import { expect, test } from "@playwright/test";

/** §7.2 spec 9: the dev hub and its docs pages, the two route handlers, and the config validator. */
test.describe("docs", () => {
  test("/dev renders the six cards, the validator flags ScorePeriod=40", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/dev");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/run your server/i);
    await expect(page.getByText("Community tools and references.")).toBeVisible();
    const cards = page.getByRole("list").first().getByRole("link");
    await expect(cards).toHaveCount(6);
    await expect(cards.filter({ hasText: "Config Template" })).toHaveAttribute("download", "");
    await expect(cards.filter({ hasText: "Config Template" })).toHaveAttribute(
      "href",
      "/ServerSettings.ini",
    );

    const box = page.getByLabel("Paste your ServerSettings.ini");
    await box.fill("[MatchState.Playing.KOTH]\nScorePeriod=40\n");
    await page.getByRole("button", { name: "Validate" }).click();
    await expect(page.getByText("Rejected")).toBeVisible();
    await expect(page.getByText(/ScorePeriod=40 is outside 18–30/)).toBeVisible();

    await page.getByRole("button", { name: "Load the template" }).click();
    await expect(box).toHaveValue(/WDRCONSettings/);
    await page.getByRole("button", { name: "Validate" }).click();
    await expect(page.getByText("Valid", { exact: true })).toBeVisible();

    // The annotated template: first section open, others collapsed and toggleable.
    const details = page.locator("details", { hasText: "The RCON listener" });
    await expect(details).not.toHaveAttribute("open", "");
    await details.locator("summary").click();
    await expect(details.getByText("PasswordHash", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("/rcon-reference: generated table, API version in the header, TOC scroll-spy", async ({
    page,
  }, testInfo) => {
    await page.goto("/rcon-reference");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/wardogs server reference/i);
    await expect(page.getByText(/Updated 2026-09-10 · v0\.27/)).toBeVisible();
    if (testInfo.project.name === "desktop") {
      const toc = page.getByRole("navigation", { name: "Contents", exact: true });
      await expect(toc.getByRole("link", { name: /Overview/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
      await page.locator("section[id='08']").scrollIntoViewIfNeeded();
      await expect(toc.getByRole("link", { name: /ServerSettings\.ini/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(toc.getByRole("link", { name: /Overview/ })).not.toHaveAttribute(
        "aria-current",
        "true",
      );
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page.getByText(/35 of 35 endpoints/)).toBeVisible();
    const rows = page.getByRole("table", { name: /every endpoint/i }).locator("tbody tr");
    await expect(rows).toHaveCount(35);
    await expect(rows.first().getByRole("link")).toHaveAttribute("href", /\/rcon-api\?endpoint=/);
    await page.getByRole("searchbox").fill("bans");
    await expect(page.getByText(/^3 of 35 endpoints/)).toBeVisible();
    await page.getByRole("button", { name: "Write" }).click();
    await expect(page.getByText(/^2 of 35 endpoints/)).toBeVisible();

    await expect(page.getByRole("button", { name: "Copy for Claude / ChatGPT" })).toBeVisible();
    await expect(page.locator('a[download][href="/ServerSettings.ini"]')).toHaveCount(1);
  });

  test("/discord-help: the stepper reaches outcome D and survives a reload", async ({ page }) => {
    await page.goto("/discord-help");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/won.t launch/i);
    await expect(page.getByText("Question 1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Yes" }).click();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("Question 3 of 3")).toBeVisible();
    await page.getByRole("button", { name: "No" }).click();
    const outcome = page.getByRole("region", { name: "It is that channel or its category." });
    await expect(outcome).toBeVisible();
    await expect(outcome).toHaveAttribute("data-outcome", "D");
    await expect(outcome.getByRole("link", { name: /nine times out of ten/ })).toHaveAttribute(
      "href",
      "#answer",
    );
    await page.reload();
    await expect(
      page.getByRole("region", { name: "It is that channel or its category." }),
    ).toBeVisible();
    await page.getByRole("button", { name: /start over/i }).click();
    await expect(page.getByText("Question 1 of 3")).toBeVisible();
    // The article's edit (§4.9) is in place.
    await expect(
      page.getByText("A whole-app failure would affect every server, not one."),
    ).toBeVisible();
  });

  test("/map-guide: sections, the zone table and the keypad figure", async ({ page }) => {
    await page.goto("/map-guide");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/how this site draws a map/i);
    for (const id of [
      "tldr",
      "why-procedural",
      "coordinates",
      "grid",
      "zones",
      "custom-maps",
      "adding-a-map",
      "reference",
    ]) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
    await expect(page.getByRole("img", { name: /D7, divided into nine/ })).toBeVisible();
    const zones = page.getByRole("table", { name: /control zone anchors/i });
    await expect(zones.locator("tbody tr")).toHaveCount(3);
    await expect(zones.getByText("Zestafona")).toBeVisible();
  });

  test("/openapi.json is the spec with 31 paths; /ServerSettings.ini downloads", async ({
    request,
  }) => {
    const spec = await request.get("/openapi.json");
    expect(spec.status()).toBe(200);
    expect(spec.headers()["content-type"]).toMatch(/application\/json/);
    expect(spec.headers()["cache-control"]).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    const json = (await spec.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(json.openapi).toMatch(/^3\./);
    expect(Object.keys(json.paths)).toHaveLength(31);

    const ini = await request.get("/ServerSettings.ini");
    expect(ini.status()).toBe(200);
    expect(ini.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    expect(ini.headers()["content-disposition"]).toBe('attachment; filename="ServerSettings.ini"');
    expect(await ini.text()).toContain("[/Script/WDRCON.WDRCONSettings]");
  });

  test("docs pages carry TechArticle + BreadcrumbList JSON-LD and canonical URLs", async ({
    page,
  }) => {
    for (const path of ["/dev", "/rcon-reference", "/discord-help", "/map-guide"]) {
      await page.goto(path);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = blocks.map((b) => (JSON.parse(b) as { "@type": string })["@type"]);
      expect(types, path).toContain("TechArticle");
      expect(types, path).toContain("BreadcrumbList");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`${path}$`),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  });
});
