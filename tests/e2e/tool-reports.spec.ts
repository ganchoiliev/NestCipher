import { expect, test, type Page } from "@playwright/test";
import type { ScanResponse } from "../../src/types/headers-scanner";
import type { EmailAnalysisResponse } from "../../src/types/email-analyzer";

test.use({ javaScriptEnabled: true, viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("a mocked header report expands long values on mobile and resets the form", async ({ page }) => {
  const target = `https://example.test/${"resource".repeat(32)}`;
  const longValue = `default-src 'self'; script-src 'self' https://assets.example.test/${"content".repeat(80)}; object-src 'none'`;
  const report: ScanResponse = {
    url: target,
    grade: "B",
    score: 15,
    maxScore: 25,
    scannedAt: "2026-10-09T12:00:00.000Z",
    headers: [
      { name: "Content-Security-Policy", present: true, value: longValue, score: 15, maxScore: 15, status: "pass", description: "Limits which sources the browser may load.", recommendation: null },
      { name: "X-Frame-Options", present: false, value: null, score: 0, maxScore: 10, status: "fail", description: "Controls whether other sites may frame this page.", recommendation: "Add a DENY or SAMEORIGIN policy where appropriate." },
    ],
    serverInfo: { ip: "192.0.2.10", server: "example-server/1.0", poweredBy: "example-runtime/2.0" },
  };
  const submitted: unknown[] = [];
  await page.route("**/api/scan-headers", async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: report });
  });

  await page.goto("/tools/headers-scanner");
  const targetInput = page.getByRole("textbox", { name: "TARGET URL", exact: true });
  const submit = page.getByRole("button", { name: "Scan headers", exact: true });
  await expect(submit).toBeDisabled();
  await targetInput.fill(target);
  await submit.click();

  const result = page.getByRole("region", { name: "Header report", exact: true });
  await expect(result).toBeVisible();
  expect(submitted).toEqual([{ url: target }]);
  await expect(result.getByRole("heading", { name: "Content-Security-Policy", exact: true })).toBeVisible();
  await expect(result.getByText("Add a DENY or SAMEORIGIN policy where appropriate.", { exact: true })).toBeVisible();

  const expandValue = result.getByRole("button", { name: "Expand Content-Security-Policy value", exact: true });
  await expect(expandValue).toHaveAttribute("aria-expanded", "false");
  await expandValue.click();
  const expandedValue = result.getByRole("button", { name: "Collapse Content-Security-Policy value", exact: true });
  await expect(expandedValue).toHaveText(longValue);
  await expect(expandedValue).toHaveAttribute("aria-expanded", "true");
  await expectNoHorizontalOverflow(page);

  await result.getByRole("button", { name: "Scan Another", exact: true }).click();
  await expect(result).toHaveCount(0);
  await expect(targetInput).toHaveValue("");
  await expect(targetInput).toBeFocused();
  await expect(submit).toBeDisabled();
});

test("a mocked email report keeps long findings readable on mobile and resets the form", async ({ page }) => {
  const longLink = `https://account-verify.example.test/${"verification".repeat(40)}`;
  const email = `From: alerts@example.test\nSubject: Verify your account\n\nPlease verify your account at ${longLink}`;
  const report: EmailAnalysisResponse = {
    overallScore: 82,
    overallLevel: "high",
    verdict: "Likely phishing: inspect the destination before taking action.",
    summary: "This email combines account urgency with an unfamiliar verification destination.",
    categories: [
      { name: "Phishing", score: 82, level: "high", findings: [`Link destination: ${longLink}`], explanation: "The destination does not match a known account provider." },
    ],
    suspiciousElements: [{ type: "link", value: longLink, reason: "An unfamiliar destination requests account verification." }],
    recommendations: ["Visit the account provider directly using a saved bookmark."],
    analysedAt: "2026-10-09T12:00:00.000Z",
  };
  const submitted: unknown[] = [];
  await page.route("**/api/analyze-email", async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: report });
  });

  await page.goto("/tools/email-analyzer");
  const emailInput = page.getByRole("textbox", { name: "EMAIL CONTENT", exact: true });
  const submit = page.getByRole("button", { name: "Analyze Email", exact: true });
  await expect(submit).toBeDisabled();
  await emailInput.fill(email);
  await submit.click();

  const result = page.getByRole("region", { name: "Email analysis report", exact: true });
  await expect(result).toBeVisible();
  expect(submitted).toEqual([{ emailContent: email }]);
  await expect(result.getByText(report.verdict, { exact: true })).toBeVisible();
  await expect(result.getByText(longLink, { exact: true })).toBeVisible();

  const scoreExplainer = result.getByRole("button", { name: "What does this score mean?", exact: true });
  await expect(scoreExplainer).toHaveAttribute("aria-expanded", "false");
  await scoreExplainer.click();
  await expect(scoreExplainer).toHaveAttribute("aria-expanded", "true");
  await expect(result.getByText("Strong phishing indicators. Do not interact with this email.", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await result.getByRole("button", { name: "Analyze Another", exact: true }).click();
  await expect(result).toHaveCount(0);
  await expect(emailInput).toHaveValue("");
  await expect(emailInput).toBeFocused();
  await expect(submit).toBeDisabled();
});
