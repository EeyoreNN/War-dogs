import { expect, test } from "@playwright/test";

// Mirrors playwright.config.ts: the build gets NEXT_PUBLIC_SITE_URL = the server it starts.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3100}`;

test.describe("seo", () => {
  test("sitemap lists the public routes with absolute URLs", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("xml");
    const xml = await res.text();
    for (const path of ["/", "/demo", "/create", "/join", "/dev", "/terms", "/privacy"]) {
      expect(xml).toContain(`<loc>${new URL(path, siteUrl).toString()}</loc>`);
    }
    expect(xml).not.toContain("/room/");
  });

  test("robots allows the site and disallows private routes", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toMatch(/Allow: \//);
    for (const p of ["/room/", "/r/", "/activity", "/add", "/terrain/", "/demo/admin/live"]) {
      expect(txt).toContain(`Disallow: ${p}`);
    }
    expect(txt).toContain(`Sitemap: ${new URL("/sitemap.xml", siteUrl).toString()}`);
  });

  test("web manifest", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("wardogs.tech");
    expect(json.short_name).toBe("Wardogs map");
    expect(json.display).toBe("standalone");
    expect(json.start_url).toBe("/join");
    expect(json.icons.some((i: { src: string }) => i.src === "/icon")).toBe(true);
  });

  test("canonical tags on public routes", async ({ page }) => {
    for (const path of ["/", "/terms", "/privacy"]) {
      await page.goto(path);
      const href = await page.locator('link[rel="canonical"]').getAttribute("href");
      // Next emits the root canonical without a trailing slash; compare as URLs, not strings.
      expect(new URL(href ?? "", siteUrl).href, path).toBe(new URL(path, siteUrl).href);
    }
  });

  test("each page unfurls as itself: og:title / twitter:title follow the page, not the home page", async ({
    page,
  }) => {
    const meta = async (sel: string) => page.locator(sel).first().getAttribute("content");
    await page.goto("/");
    const homeTitle = await meta('meta[property="og:title"]');
    expect(homeTitle).toMatch(/^wardogs\.tech — /);
    for (const [path, title] of [
      ["/dev", /^Run your server/],
      ["/terms", /^Terms of Service/],
      ["/demo", /^The live demo/],
      ["/room/ABC234", /^War room/],
    ] as const) {
      await page.goto(path);
      expect(await meta('meta[property="og:title"]'), path).toMatch(title);
      expect(await meta('meta[name="twitter:title"]'), path).toMatch(title);
      expect(await meta('meta[property="og:description"]'), path).not.toBe(
        "Draw the plan. Call the drop. Everyone sees it.",
      );
    }
    // A page that sets `openGraph.url` keeps it; nothing inherits the home page's URL.
    await page.goto("/demo");
    expect(new URL((await meta('meta[property="og:url"]')) ?? "", siteUrl).pathname).toBe("/demo");
    await page.goto("/dev");
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  });

  test("noindex pages carry no canonical (never the home page's) and an X-Robots-Tag", async ({
    page,
    request,
  }) => {
    for (const path of ["/room/ABC234", "/activity", "/demo/admin/live", "/add"]) {
      await page.goto(path);
      // A noindex page either has no canonical or points at itself (/add, §6.1) — never at `/`.
      const canonical = await page
        .locator('link[rel="canonical"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
      for (const href of canonical) expect(new URL(href, siteUrl).pathname, path).toBe(path);
      const res = await request.get(path);
      expect(res.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    }
    for (const path of ["/", "/demo", "/demo/admin"]) {
      const res = await request.get(path);
      expect(res.headers()["x-robots-tag"], path).toBeUndefined();
    }
  });

  test("noindex on room routes, /add and the 404", async ({ page }) => {
    for (const path of ["/room/ABC234", "/add", "/this-does-not-exist"]) {
      await page.goto(path);
      // Next adds its own `noindex` meta on not-found routes next to the §6.1 metadata one;
      // every robots meta on the page must say noindex, and there must be at least one.
      const robots = await page
        .locator('meta[name="robots"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
      expect(robots.length, path).toBeGreaterThanOrEqual(1);
      for (const content of robots) expect(content, path).toMatch(/noindex/);
    }
  });

  test("JSON-LD parses and carries the FAQ", async ({ page }) => {
    await page.goto("/");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const parsed = blocks.map((b) => JSON.parse(b) as { "@type": string; mainEntity?: unknown[] });
    const types = parsed.map((p) => p["@type"]);
    expect(types).toEqual(expect.arrayContaining(["WebSite", "SoftwareApplication", "FAQPage"]));
    const faq = parsed.find((p) => p["@type"] === "FAQPage");
    expect(faq?.mainEntity).toHaveLength(5);
  });

  test("og:image:alt is set", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveCount(1);
  });
});
