import { expect, test, type Locator } from "@playwright/test";

// JavaScript is disabled for every test in this file (playwright.config.ts).
// Playwright's toBeVisible() treats opacity:0 elements as visible, so these
// tests assert COMPUTED opacity — the exact failure mode of the old
// framer-motion wrappers was content stuck at opacity 0 without JS.

async function computedOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((el) => Number(getComputedStyle(el).opacity));
}

async function expectFullyVisible(locator: Locator) {
  expect(await computedOpacity(locator)).toBeGreaterThan(0.99);
}

test("home renders its heading and tool list without JavaScript", async ({ page }) => {
  await page.goto("/");
  const h1 = page.locator("h1");
  await expect(h1).toContainText("Security Tools");

  await page.waitForTimeout(900); // let the CSS-only entrance finish
  await expectFullyVisible(h1);

  const toolLinks = page.locator('a[href^="/tools/"]');
  expect(await toolLinks.count()).toBeGreaterThanOrEqual(3);

  for (const card of await page.locator(".rise-in").all()) {
    await expectFullyVisible(card);
  }
});

test("/tools renders its heading and tool list without JavaScript", async ({ page }) => {
  await page.goto("/tools");
  await expect(page.locator("h1")).toContainText("Security Toolkit");

  await page.waitForTimeout(900);

  const toolLinks = page.locator('a[href^="/tools/"]');
  expect(await toolLinks.count()).toBeGreaterThanOrEqual(3);

  for (const card of await page.locator(".rise-in").all()) {
    await expectFullyVisible(card);
  }
});

test("the retired tool page and about page render without JavaScript", async ({ page }) => {
  await page.goto("/tools/prompt-injection-tester");
  await expect(page.locator("h1")).toContainText("Prompt Injection Tester");
  await expect(page.getByText("Retired. Coming back as a canary-based leak test.")).toHaveCount(1);

  await page.goto("/about");
  await expect(page.locator("h1")).toContainText("About Nest Cipher");
  await page.waitForTimeout(900);
  for (const section of await page.locator(".rise-in").all()) {
    await expectFullyVisible(section);
  }
});
