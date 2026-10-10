import { expect, test, type Locator } from "@playwright/test";

// JavaScript is disabled for every test in this file (playwright.config.ts).
// Playwright's toBeVisible() treats opacity:0 elements as visible, so these
// tests also check the element and its ancestors. A visible child can still
// disappear inside an animation wrapper that never runs without JavaScript.

async function computedOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    let opacity = 1;
    for (let current: Element | null = el; current; current = current.parentElement) {
      opacity *= Number(getComputedStyle(current).opacity);
    }
    return opacity;
  });
}

async function expectFullyVisible(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect.poll(() => computedOpacity(locator)).toBeGreaterThan(0.99);
}

test("home renders its heading and tool list without JavaScript", async ({ page }) => {
  await page.goto("/");
  const h1 = page.locator("h1");
  await expect(h1).toContainText(/LOOK\s*CLOSER/i);
  await expectFullyVisible(h1);

  const toolLinks = page.getByRole("navigation", { name: "Tool shortcuts", exact: true }).getByRole("link");
  await expect(toolLinks).toHaveCount(3);

  for (const card of await toolLinks.all()) {
    await expectFullyVisible(card);
  }
  const catalogLinks = page.getByRole("region", { name: "01 / THE TOOLKIT", exact: true }).locator('a[href^="/tools/"]');
  await expect(catalogLinks).toHaveCount(4);
  await expectFullyVisible(catalogLinks.filter({ hasText: "Research Workbench" }));
});

test("/tools renders its heading and tool list without JavaScript", async ({ page }) => {
  await page.goto("/tools");
  await expect(page.locator("h1")).toContainText(/security toolkit/i);
  await expectFullyVisible(page.locator("h1"));

  const toolLinks = page.locator('a[href^="/tools/"]');
  expect(await toolLinks.count()).toBeGreaterThanOrEqual(4);

  for (const card of await toolLinks.all()) {
    await expectFullyVisible(card);
  }
});

test("the retired tool page and about page render without JavaScript", async ({ page }) => {
  await page.goto("/tools/prompt-injection-tester");
  await expect(page.locator("h1")).toContainText("Prompt Injection Tester");
  await expect(page.getByText("Retired. Coming back as a canary-based leak test.")).toHaveCount(1);

  await page.goto("/about");
  await expect(page.locator("h1")).toContainText(/Behind\s*the toolkit/i);
  await expectFullyVisible(page.locator("h1"));
  for (const section of await page.locator("main section").all()) {
    await expectFullyVisible(section);
  }
});

test("the OWASP reference list stays readable without JavaScript", async ({ page }) => {
  await page.goto("/tools/owasp-llm-top-10");
  await expectFullyVisible(page.locator("h1"));

  const referenceRows = page.getByRole("main").getByRole("button", { name: /^LLM\d{2}/ });
  await expect(referenceRows).toHaveCount(10);
  await expect(page.getByText("Prompt Injection", { exact: true })).toBeVisible();
  await expect(page.getByText("Unbounded Consumption", { exact: true })).toBeVisible();

  for (const row of await referenceRows.all()) {
    await expectFullyVisible(row);
  }
  await expectFullyVisible(page.getByText("An attacker crafts inputs", { exact: false }));
  await expectFullyVisible(page.getByText("Attackers exploit LLMs to consume excessive resources", { exact: false }));
});

test("the community field guide and resource links render without JavaScript", async ({ page }) => {
  await page.goto("/community");
  await expectFullyVisible(page.getByRole("heading", { level: 1 }));

  const main = page.getByRole("main");
  await expectFullyVisible(main.getByRole("heading", { name: "Gray Swan Arena", exact: true }));
  await expectFullyVisible(main.getByRole("heading", { name: "OWASP GenAI Security", exact: true }));
  await expectFullyVisible(main.getByRole("heading", { name: "PortSwigger Research", exact: true }));
  await expectFullyVisible(main.getByRole("heading", { name: "CyberChef", exact: true }));
  await expect(main.getByRole("link", { name: /Gray Swan Arena/ }).last()).toHaveAttribute("href", "https://app.grayswan.ai/arena");
  await expect(main.getByRole("link", { name: /OWASP GenAI Security/ })).toHaveAttribute("href", "https://genai.owasp.org/llm-top-10/");
  await expectFullyVisible(main.locator("#research-notes"));
});

test("the workbench explains its private session workflow without JavaScript", async ({ page }) => {
  await page.goto("/tools/research-workbench");
  await expectFullyVisible(page.getByRole("heading", { level: 1 }));
  await expect(page.getByText(/needs JavaScript to keep a session in page memory/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Start an experiment/ })).toBeDisabled();
  await expect(page.locator('script[src*="plausible.io"], script#plausible-init')).toHaveCount(0);
});
