import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ScanResponse } from "../../src/types/headers-scanner";
import type { EmailAnalysisResponse } from "../../src/types/email-analyzer";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

async function expectContained(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
}

async function expectReadableField(field: Locator) {
  expect(await field.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
}

async function expectTouchTarget(control: Locator) {
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
}

for (const [width, theme] of [[320, "dark"], [390, "light"]] as const) {
  test(`mobile editing and local research remain usable at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    const unexpectedRequests: string[] = [];
    page.on("request", (request) => { if (/\/api\//.test(request.url())) unexpectedRequests.push(request.url()); });

    await page.goto("/tools/headers-scanner");
    await expectReadableField(page.getByRole("textbox", { name: "TARGET URL", exact: true }));
    await page.goto("/tools/email-analyzer");
    await expectReadableField(page.getByRole("textbox", { name: "EMAIL CONTENT", exact: true }));

    await page.goto("/tools/research-workbench");
    await page.getByRole("button", { name: "Plan an experiment", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toBeFocused();
    await expectReadableField(page.locator("#plan-baseline"));
    const conditions = page.locator("summary").filter({ hasText: "Record known conditions" });
    await expectTouchTarget(conditions);
    await conditions.click();
    await expectReadableField(page.locator("#plan-target"));
    await page.getByRole("button", { name: "Load synthetic plan", exact: true }).click();
    await page.getByRole("button", { name: "Review plan", exact: true }).click();
    await expectContained(page);
    await page.getByRole("button", { name: "Close Prompt Studio", exact: true }).click();
    const discard = page.getByRole("dialog", { name: "Close Prompt Studio?", exact: true });
    await expect(discard).toBeVisible();
    await expectContained(page);
    await discard.getByRole("button", { name: "Discard plan and close", exact: true }).click();

    await page.getByRole("button", { name: "Local library", exact: true }).click();
    const vault = page.getByRole("dialog", { name: "Vault & backup", exact: true });
    await vault.getByRole("button", { name: "Create a new vault", exact: true }).click();
    const phrase = "public synthetic mobile audit passphrase";
    const password = vault.getByLabel("New vault passphrase", { exact: true });
    await expectReadableField(password);
    await password.fill(phrase);
    await vault.getByLabel("Confirm vault passphrase", { exact: true }).fill(phrase);
    await expectContained(page);
    await vault.getByRole("button", { name: "Create vault", exact: true }).click();
    await expect(vault.getByText(/Unlocked · 0 saved experiments/)).toBeVisible();
    await vault.getByRole("button", { name: "Close library", exact: true }).click();
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    await page.getByRole("button", { name: "Load synthetic example", exact: true }).click();
    await expectReadableField(page.getByTestId("attempt-input"));
    await page.getByRole("button", { name: "Save locally", exact: true }).click();
    await expect(page.getByTestId("storage-status")).toContainText("Saved locally");
    await page.getByRole("button", { name: "Research library", exact: true }).click();
    const library = page.getByRole("region", { name: "Research library", exact: true });
    await expectReadableField(library.getByLabel("Search saved research", { exact: true }));
    await expect(library.getByRole("button", { name: /^Open saved experiment/ })).toHaveCount(1);
    await expectContained(page);
    expect(unexpectedRequests).toEqual([]);
  });
}

test("320px mobile navigation has touch targets, announced state and Escape focus recovery", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/tools");
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  const theme = page.getByRole("button", { name: /^Switch to .* theme$/ });
  await expectTouchTarget(toggle);
  await expectTouchTarget(theme);
  await toggle.click();
  const close = page.getByRole("button", { name: "Close menu", exact: true });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  const navigation = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
  await expect(navigation).toBeVisible();
  for (const link of await navigation.getByRole("link").all()) await expectTouchTarget(link);
  await expectContained(page);
  await page.keyboard.press("Escape");
  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeFocused();
});

test("320px mocked reports wrap long evidence while maintaining readable editable fields", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const longLink = `https://synthetic.example.test/${"long-source-value".repeat(40)}`;
  const headerValue = `default-src 'self'; script-src 'self' ${longLink}; object-src 'none'`;
  const headerReport: ScanResponse = {
    url: longLink, grade: "B", score: 15, maxScore: 25, scannedAt: "2026-10-01T00:00:00.000Z",
    headers: [{ name: "Content-Security-Policy", present: true, value: headerValue, score: 15, maxScore: 15, status: "pass", description: "Authored synthetic policy for mobile layout verification.", recommendation: null }],
    serverInfo: { ip: "192.0.2.1", server: "synthetic-server/1.0", poweredBy: null },
  };
  const emailReport: EmailAnalysisResponse = {
    overallScore: 82, overallLevel: "high", verdict: "Authored synthetic email finding.", summary: "A fixture for mobile layout only.",
    categories: [{ name: "Phishing", score: 82, level: "high", findings: [`Invented destination: ${longLink}`], explanation: "An invented destination, not a live analysis." }],
    suspiciousElements: [{ type: "link", value: longLink, reason: "Authored synthetic finding." }],
    recommendations: ["Inspect the recorded destination."], analysedAt: "2026-10-01T00:00:00.000Z",
  };
  await page.route("**/api/scan-headers", (route) => route.fulfill({ status: 200, json: headerReport }));
  await page.route("**/api/analyze-email", (route) => route.fulfill({ status: 200, json: emailReport }));
  await page.goto("/tools/headers-scanner");
  const target = page.getByRole("textbox", { name: "TARGET URL", exact: true });
  await expectReadableField(target);
  await target.fill(longLink);
  await page.getByRole("button", { name: "Scan headers", exact: true }).click();
  const headers = page.getByRole("region", { name: "Header report", exact: true });
  await expect(headers).toBeVisible();
  await headers.getByRole("button", { name: "Expand Content-Security-Policy value", exact: true }).click();
  await expect(headers.getByRole("button", { name: "Collapse Content-Security-Policy value", exact: true })).toHaveText(headerValue);
  await expectContained(page);
  await page.goto("/tools/email-analyzer");
  const email = page.getByRole("textbox", { name: "EMAIL CONTENT", exact: true });
  await expectReadableField(email);
  await email.fill(`From: synthetic@example.test\nSubject: Invented fixture\n\n${longLink}`);
  await page.getByRole("button", { name: "Analyze Email", exact: true }).click();
  const result = page.getByRole("region", { name: "Email analysis report", exact: true });
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: "What does this score mean?", exact: true }).click();
  await expectContained(page);
});
