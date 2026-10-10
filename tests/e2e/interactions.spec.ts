import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: true });

test("the launcher selects tools and transfers a scanner draft without running a scan", async ({ page }) => {
  const scanRequests: string[] = [];
  await page.route("**/api/scan-headers", async (route) => {
    scanRequests.push(route.request().url());
    await route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const launcher = page.getByRole("region", { name: "Tool launcher", exact: true });
  const headers = launcher.getByRole("button", { name: "Headers", exact: true });
  const email = launcher.getByRole("button", { name: "Email", exact: true });
  const llmRisks = launcher.getByRole("button", { name: "LLM risks", exact: true });
  const targetInput = launcher.getByRole("textbox", { name: "Target URL", exact: true });
  const openScanner = launcher.getByRole("button", { name: "Open scanner", exact: true });
  await expect(headers).toHaveAttribute("aria-pressed", "true");
  await expect(openScanner).toBeDisabled();

  await email.click();
  await expect(email).toHaveAttribute("aria-pressed", "true");
  await expect(headers).toHaveAttribute("aria-pressed", "false");
  await expect(targetInput).toBeHidden();
  await expect(launcher.getByRole("link", { name: "Open email analyzer", exact: true })).toHaveAttribute("href", "/tools/email-analyzer");

  await llmRisks.click();
  await expect(llmRisks).toHaveAttribute("aria-pressed", "true");
  await expect(launcher.getByRole("link", { name: "Explore LLM risks", exact: true })).toHaveAttribute("href", "/tools/owasp-llm-top-10");

  await headers.click();
  const target = "https://example.test/private/review?token=preview-only";
  await targetInput.fill(target);
  await expect(openScanner).toBeEnabled();
  await openScanner.click();
  await expect(page).toHaveURL(/\/tools\/headers-scanner$/);
  const scannerInput = page.getByRole("textbox", { name: "TARGET URL", exact: true });
  await expect(scannerInput).toHaveValue(target);
  await expect(page.getByRole("button", { name: "Scan headers", exact: true })).toBeEnabled();
  expect(scanRequests).toEqual([]);

  // Draft targets belong to this client navigation, not browser URLs or
  // persistent storage. A full reload starts a fresh scanner form.
  await page.reload();
  await expect(page).toHaveURL(/\/tools\/headers-scanner$/);
  await expect(scannerInput).toHaveValue("");
  await expect(page.getByRole("button", { name: "Scan headers", exact: true })).toBeDisabled();
  expect(scanRequests).toEqual([]);
});

test("catalog search and categories combine, and reset restores every tool", async ({ page }) => {
  await page.goto("/tools");

  const main = page.getByRole("main");
  const search = main.getByRole("searchbox", { name: "Find a tool", exact: true });
  const toolLinks = main.locator('a[href^="/tools/"]');
  const allTools = main.getByRole("button", { name: /^All tools/ });
  await expect(toolLinks).toHaveCount(4);
  await expect(allTools).toHaveAttribute("aria-pressed", "true");

  await search.fill("headers");
  await expect(toolLinks).toHaveCount(1);
  await expect(toolLinks).toHaveAttribute("href", "/tools/headers-scanner");

  const aiTools = main.getByRole("button", { name: /^AI Tools/ });
  await aiTools.click();
  await expect(aiTools).toHaveAttribute("aria-pressed", "true");
  await expect(toolLinks).toHaveCount(0);
  await main.getByRole("button", { name: "View all tools", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(allTools).toHaveAttribute("aria-pressed", "true");
  await expect(toolLinks).toHaveCount(4);

  await main.getByRole("button", { name: /^Learning/ }).click();
  await expect(toolLinks).toHaveCount(1);
  await expect(toolLinks).toHaveAttribute("href", "/tools/owasp-llm-top-10");
  await main.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(allTools).toHaveAttribute("aria-pressed", "true");
  await expect(toolLinks).toHaveCount(4);

  await search.fill("pHiShInG");
  await expect(toolLinks).toHaveCount(1);
  await expect(toolLinks).toHaveAttribute("href", "/tools/email-analyzer");
  await main.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(toolLinks).toHaveCount(4);
});

test("mobile navigation opens, closes, and follows a tool-catalog link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const openMenu = page.getByRole("button", { name: "Open menu", exact: true });
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");
  await openMenu.click();

  const menu = page.locator("#mobile-navigation");
  const closeMenu = page.getByRole("button", { name: "Close menu", exact: true });
  await expect(menu).toBeVisible();
  await expect(closeMenu).toHaveAttribute("aria-expanded", "true");
  await closeMenu.click();
  await expect(menu).toBeHidden();

  await openMenu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(openMenu).toBeFocused();

  await openMenu.click();
  await menu.getByRole("link", { name: /Tools$/ }).click();
  await expect(page).toHaveURL(/\/tools$/);
  await expect(page.getByRole("searchbox", { name: "Find a tool", exact: true })).toBeVisible();
  await expect(menu).toBeHidden();
  await expect(openMenu).toHaveAttribute("aria-expanded", "false");
});

test("the selected theme applies and survives a reload", async ({ page }) => {
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).toHaveClass(/\bdark\b/);
  await page.getByRole("button", { name: "Switch to light theme", exact: true }).click();
  await expect(html).toHaveClass(/\blight\b/);
  await expect(page.getByRole("button", { name: "Switch to dark theme", exact: true })).toBeVisible();

  await page.reload();
  await expect(html).toHaveClass(/\blight\b/);
  await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
  await expect(html).toHaveClass(/\bdark\b/);
});

test("OWASP risks can be filtered, expanded, and collapsed", async ({ page }) => {
  await page.goto("/tools/owasp-llm-top-10");

  const main = page.getByRole("main");
  const referenceRows = main.getByRole("button", { name: /^LLM\d{2}/ });
  await expect(referenceRows).toHaveCount(10);

  await main.getByRole("button", { name: "Critical", exact: true }).click();
  await expect(referenceRows).toHaveCount(2);
  await expect(main.getByText("Prompt Injection", { exact: true })).toBeVisible();
  await expect(main.getByText("Unbounded Consumption", { exact: true })).toHaveCount(0);

  await main.getByRole("button", { name: "All", exact: true }).click();
  await expect(referenceRows).toHaveCount(10);

  const expander = main.getByRole("button", { name: /LLM01.*Prompt Injection/ });
  await expect(expander).toHaveAttribute("aria-expanded", "false");
  const detailId = await expander.getAttribute("aria-controls");
  expect(detailId).toBeTruthy();
  const detail = main.locator(`#${detailId}`);
  await expect(detail).toBeHidden();
  await expander.click();
  await expect(expander).toHaveAttribute("aria-expanded", "true");
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Real-world example", exact: true })).toBeVisible();
  await expect(detail.getByRole("heading", { name: "Mitigations", exact: true })).toBeVisible();
  await expect(main.getByRole("progressbar", { name: "Vulnerabilities explored", exact: true })).toHaveAttribute("aria-valuenow", "1");

  await detail.getByRole("button", { name: "Collapse", exact: true }).click();
  await expect(expander).toHaveAttribute("aria-expanded", "false");
  await expect(detail).toBeHidden();
});

test("the OWASP quiz checks an answer, advances, and returns to the reference", async ({ page }) => {
  await page.goto("/tools/owasp-llm-top-10");
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "Quiz", exact: true }).click();
  await expect(main.getByText("Question 1 of 10", { exact: true })).toBeVisible();
  const checkAnswer = main.getByRole("button", { name: "Check Answer", exact: true });
  await expect(checkAnswer).toBeDisabled();

  // The quiz shuffles its questions. Any answer should unlock feedback and
  // progression, regardless of the question chosen for this browser session.
  const firstOption = main.getByRole("button", { name: /^A\./ });
  await firstOption.click();
  await expect(checkAnswer).toBeEnabled();
  await checkAnswer.click();
  await expect(firstOption).toBeDisabled();
  await expect(main.getByText(/(?:introductory|intermediate|advanced) question/)).toBeVisible();

  await main.getByRole("button", { name: "Next Question", exact: true }).click();
  await expect(main.getByText("Question 2 of 10", { exact: true })).toBeVisible();
  await expect(checkAnswer).toBeDisabled();

  await main.getByRole("button", { name: "Exit Quiz", exact: true }).click();
  await expect(main.getByRole("button", { name: /^LLM\d{2}/ })).toHaveCount(10);
  await expect(main.getByText("Question 2 of 10", { exact: true })).toHaveCount(0);
});
