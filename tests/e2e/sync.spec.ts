// §7.2 spec 3 — sync: (a) LOCAL two tabs in one context, (b) RELAY two browser contexts against
// the relay Playwright starts (§7.5). Desktop project only.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => !!isMobile, "desktop only");

const RELAY = "ws://127.0.0.1:8787";

/** Fresh identity + relay override per context, before any page script runs. */
async function prime(context: BrowserContext, relay: "off" | string, callsign: string) {
  await context.addInitScript(
    ({ relay, callsign }) => {
      if (!localStorage.getItem("wardogs:identity")) {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let id = "wd_";
        for (let i = 0; i < 12; i++) id += alphabet[Math.floor(Math.random() * 32)];
        localStorage.setItem(
          "wardogs:identity",
          JSON.stringify({ v: 1, client: id, callsign, focus: null, ink: "blue" }),
        );
      }
      localStorage.setItem("wardogs:relay", relay);
    },
    { relay, callsign },
  );
}

/** Open a war room through /create and return its code. */
async function createRoom(page: Page): Promise<string> {
  await page.goto("/create");
  await page.getByRole("button", { name: /open war room/i }).click();
  await page.waitForURL(/\/room\/[A-HJ-NP-Z2-9]{6}/);
  return page.url().match(/\/room\/([A-HJ-NP-Z2-9]{6})/)![1];
}

const map = (page: Page) => page.getByRole("application");
const syncPill = (page: Page) => page.getByTestId("sync-pill");
const markers = (page: Page) => page.locator('[data-node-type="marker"]');

/** Place a marker with the keyboard: 2 = Rally, click on the map. */
async function placeMarker(page: Page, x: number, y: number) {
  await map(page).focus();
  await page.keyboard.press("2");
  const box = await map(page).boundingBox();
  await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
}

test.describe("sync (a) LOCAL — two tabs of one browser", () => {
  test("markers and requests flow between tabs; closing a tab keeps the member online", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await prime(context, "off", "Alpha");
    const a = await context.newPage();
    const code = await createRoom(a);
    await expect(syncPill(a)).toContainText(/LOCAL/i);

    const b = await context.newPage();
    await b.goto(`/room/${code}`);
    await expect(syncPill(b)).toContainText(/LOCAL/i);
    await expect(map(b)).toBeVisible();

    const before = await markers(b).count();
    await placeMarker(a, 0.4, 0.4);
    await expect.poll(() => markers(b).count(), { timeout: 1_000 }).toBe(before + 1);

    // Create a request in B (the kind picker is a radiogroup; Fuel is the default), claim it in
    // A, deliver it in B.
    await b.keyboard.press("n");
    const newRequest = b.getByRole("dialog", { name: /new request/i });
    await newRequest.getByRole("radio", { name: /^fuel/i }).click();
    await newRequest.getByRole("button", { name: /no location/i }).click();
    const cardA = a.getByRole("listitem").filter({ hasText: /fuel/i }).first();
    await expect(cardA).toBeVisible();
    await cardA.getByRole("button", { name: /^claim$/i }).click();
    const cardB = b.getByRole("listitem").filter({ hasText: /fuel/i }).first();
    await expect(cardB).toContainText(/claimed/i);
    await cardB.getByRole("button", { name: /^delivered$/i }).click();
    // ALL shows open + claimed only (a just-delivered card lingers there for 8 s); DONE is the
    // contract's home for delivered requests.
    await a.getByRole("tab", { name: /done/i }).click();
    await expect(a.getByRole("listitem").filter({ hasText: /fuel/i }).first()).toContainText(
      /delivered/i,
    );

    // Same browser = same client id: closing B leaves the one member online in A.
    await b.close();
    const rosterA = a.getByRole("list", { name: /roster/i });
    await expect(rosterA.getByText("Alpha")).toBeVisible();
    await expect(rosterA).not.toContainText(/offline/i);
    await context.close();
  });
});

test.describe("sync (b) RELAY — two browsers through the relay", () => {
  test("LIVE with two in room, marker fan-out, kick, and an opted-out third browser stays LOCAL", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    await prime(ctxA, RELAY, "Alpha");
    await prime(ctxB, RELAY, "Bravo");
    const a = await ctxA.newPage();
    const code = await createRoom(a);
    await expect(syncPill(a)).toContainText(/LIVE/i, { timeout: 15_000 });

    const b = await ctxB.newPage();
    await b.goto(`/join?code=${code}`);
    await b.getByRole("button", { name: /join war room/i }).click();
    await b.waitForURL(new RegExp(`/room/${code}`));
    await expect(syncPill(b)).toContainText(/LIVE/i, { timeout: 15_000 });
    await expect(syncPill(a)).toContainText(/2 in room/i, { timeout: 15_000 });

    const rosterA = a.getByRole("list", { name: /roster/i });
    await expect(rosterA.getByText("Alpha")).toBeVisible();
    await expect(rosterA.getByText("Bravo")).toBeVisible();
    await expect(b.getByRole("list", { name: /roster/i }).getByText("Alpha")).toBeVisible();

    const before = await markers(b).count();
    await placeMarker(a, 0.6, 0.5);
    await expect.poll(() => markers(b).count(), { timeout: 5_000 }).toBe(before + 1);

    // Kick from A → B sees the removed dialog.
    const rowB = rosterA.getByRole("listitem").filter({ hasText: "Bravo" });
    await rowB.getByRole("button", { name: /more|menu|⋯/i }).click();
    await a.getByRole("menuitem", { name: /kick/i }).click();
    const confirm = a.getByRole("dialog").getByRole("button", { name: /kick/i });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(b.getByRole("dialog", { name: /removed from this room/i })).toBeVisible({
      timeout: 10_000,
    });

    // A third browser that opted out of the relay is LOCAL.
    const ctxC = await browser.newContext();
    await prime(ctxC, "off", "Charlie");
    const c = await ctxC.newPage();
    await c.goto(`/room/${code}`);
    await expect(syncPill(c)).toContainText(/LOCAL/i);

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  });
});
