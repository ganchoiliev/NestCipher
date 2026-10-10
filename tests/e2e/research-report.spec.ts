import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { EmailAnalysisResponse } from "../../src/types/email-analyzer";
import type { ScanResponse } from "../../src/types/headers-scanner";
import {
  createEmailReportSnapshot, createHeadersReportSnapshot, exportReportSnapshot, type ReportSnapshot,
} from "../../src/lib/research-report";
import { createSyntheticExperiment, exportExperimentJson, withChallenge } from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce", viewport: { width: 390, height: 844 } });

const NOW = "2026-01-01T00:00:00.000Z";
const hostile = "Synthetic evidence\r\n<script>window.reportExecuted=true</script>\n```````\n---\npublish: true\n[[vault-link]]\u200B\u2028\u2029 https://never-fetch.example.test/report-canary";
const emailReport: EmailAnalysisResponse = {
  overallScore: 40, overallLevel: "medium", verdict: "Synthetic email verdict",
  categories: [{ name: "Synthetic category", score: 40, level: "medium", findings: [hostile], explanation: "Authored fixture, not live challenge content" }],
  suspiciousElements: [{ type: "other", value: hostile, reason: "Synthetic finding" }],
  recommendations: ["Synthetic recommendation"], summary: "Report-only fixture; original input is not included",
  analysedAt: NOW,
};
const headerReport: ScanResponse = {
  url: "https://example.test/returned?synthetic=canary", grade: "B", score: 15, maxScore: 25,
  scannedAt: NOW,
  headers: [{ name: "Content-Security-Policy", present: true, value: hostile, score: 15, maxScore: 25,
    status: "partial", description: "Synthetic header fixture", recommendation: "Authored recommendation" }],
  serverInfo: { ip: null, server: "synthetic-server", poweredBy: null },
};

async function downloadText(page: Page, label: string) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: label, exact: true }).first().click();
  const download = await downloading;
  const path = await download.path();
  expect(path).not.toBeNull();
  return { text: await readFile(path!, "utf8"), name: download.suggestedFilename() };
}

function expectPrivateSnapshot(snapshot: ReportSnapshot, kind: ReportSnapshot["kind"]) {
  expect(snapshot).toMatchObject({
    format: "nestcipher-report-snapshot", snapshotVersion: 1, kind,
    visibility: "private", publish: false,
    provenance: { captureScope: "report-only", rawInputIncluded: false, verification: "unverified",
      provider: null, model: null, policyVersion: null, httpMethod: null, originalTarget: null },
  });
  expect(Number.isFinite(Date.parse(snapshot.capturedAt))).toBe(true);
}

test("email report capture uses the completed response, omits raw and edited input, and makes no new analysis request", async ({ page }) => {
  const calls: unknown[] = [];
  await page.route("**/api/analyze-email", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: emailReport });
  });
  await page.goto("/tools/email-analyzer");
  const raw = "RAW EMAIL CANARY — authored source body not returned in the report";
  await page.getByRole("textbox", { name: "EMAIL CONTENT", exact: true }).fill(raw);
  await page.getByRole("button", { name: "Analyze Email", exact: true }).click();
  await expect(page.getByRole("region", { name: "Email analysis report", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "EMAIL CONTENT", exact: true }).fill("EDITED INPUT CANARY");
  await page.getByRole("button", { name: "Prepare private report snapshot", exact: true }).click();
  const capture = page.getByRole("region", { name: "Private report capture", exact: true });
  await expect(capture).toContainText("raw source input is excluded");
  await capture.getByText("Preview private email report snapshot", { exact: true }).click();
  await expect(capture.getByLabel("Report snapshot, inert text", { exact: true })).toContainText("Synthetic email verdict");
  const file = await downloadText(page, "Download private report JSON");
  const snapshot = JSON.parse(file.text) as ReportSnapshot;
  expectPrivateSnapshot(snapshot, "email-analysis");
  expect(snapshot.report).toEqual(emailReport);
  expect(file.text).not.toContain("RAW EMAIL CANARY");
  expect(file.text).not.toContain("EDITED INPUT CANARY");
  expect(file.name).toMatch(/^nestcipher-report-[0-9a-f-]+\.json$/);
  expect(calls).toEqual([{ emailContent: raw }]);
  expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "reportExecuted"))).toBe(false);
});

test("header capture retains the returned URL and unknown method without scanning again", async ({ page }) => {
  const calls: unknown[] = [];
  await page.route("**/api/scan-headers", async (route) => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: headerReport });
  });
  await page.goto("/tools/headers-scanner");
  const target = "https://example.test/original?private=target-canary";
  await page.getByRole("textbox", { name: "TARGET URL", exact: true }).fill(target);
  await page.getByRole("button", { name: "Scan headers", exact: true }).click();
  await expect(page.getByRole("region", { name: "Header report", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "TARGET URL", exact: true }).fill("https://example.test/edited");
  await page.getByRole("button", { name: "Prepare private report snapshot", exact: true }).click();
  const file = await downloadText(page, "Download private report JSON");
  const snapshot = JSON.parse(file.text) as ReportSnapshot;
  expectPrivateSnapshot(snapshot, "headers-scan");
  expect(snapshot.report).toEqual(headerReport);
  expect(file.text).not.toContain(target);
  expect(file.text).not.toContain("https://example.test/edited");
  expect(calls).toEqual([{ url: target }]);
});

test("private report attachment preserves the attempt and embargo, renders inertly, and supports nonmutating Markdown omission", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/never-fetch\.example|\/api\/|plausible\.io/.test(request.url())) requests.push(request.url());
  });
  const experiment = withChallenge(createSyntheticExperiment({ now: NOW }), {
    name: "Synthetic restricted challenge", endsAt: "2026-10-01T12:00:00.000Z", endConfirmed: true,
  }, NOW);
  const snapshot = createEmailReportSnapshot(emailReport, { now: "2026-01-02T11:00:00+02:00" });
  await page.goto("/tools/research-workbench");
  await page.getByTestId("restore-experiment").setInputFiles({ name: "private-experiment.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(experiment)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(experiment.title);
  const attachments = page.getByRole("region", { name: "Attached tool reports", exact: true });
  await attachments.getByLabel("Choose private report snapshot JSON", { exact: true }).setInputFiles({ name: "private-report.json", mimeType: "application/json", buffer: Buffer.from(exportReportSnapshot(snapshot)) });
  const attach = attachments.getByRole("button", { name: "Attach report to attempt", exact: true });
  await expect(attach).toBeEnabled();
  await attach.click();
  await expect(attachments.getByRole("button", { name: "Report attached", exact: true })).toBeDisabled();
  await attachments.getByText("Preview private email report snapshot", { exact: true }).last().click();
  await expect(attachments.getByLabel("Report snapshot, inert text", { exact: true }).last()).toContainText("window.reportExecuted");
  await expect(attachments.locator('a[href*="never-fetch"]')).toHaveCount(0);
  const full = JSON.parse((await downloadText(page, "Download full JSON backup")).text);
  expect(full.schemaVersion).toBe(2);
  expect(full.disclosure).toEqual(experiment.disclosure);
  expect(full.disclosure.publicNotBefore).toBe("2026-10-31T12:00:00.000Z");
  expect(full.attempts[0].reportSnapshots).toEqual([snapshot]);
  expect(full.attempts[0]).toEqual({ ...experiment.attempts[0], updatedAt: full.attempts[0].updatedAt, reportSnapshots: [snapshot] });
  expect(full.attempts[1]).toEqual(experiment.attempts[1]);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const markdown = (await downloadText(page, "Download private Markdown")).text;
  expect(markdown).toContain("window.reportExecuted");
  expect(markdown).toContain("````````text");
  expect(markdown).toContain("publish: false");
  expect(markdown).toContain("Raw source input is excluded");
  await page.getByRole("checkbox", { name: "Attached report snapshots", exact: true }).uncheck();
  const omitted = (await downloadText(page, "Download private Markdown")).text;
  expect(omitted).not.toContain("window.reportExecuted");
  expect(omitted).toContain("All report snapshots omitted");
  expect(JSON.parse((await downloadText(page, "Download full JSON backup")).text)).toEqual(full);
  expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "reportExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("invalid report files never attach or change the current private draft", async ({ page }) => {
  const experiment = createSyntheticExperiment({ now: NOW });
  await page.goto("/tools/research-workbench");
  await page.getByTestId("restore-experiment").setInputFiles({ name: "private-experiment.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(experiment)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(experiment.title);
  const snapshot = createHeadersReportSnapshot(headerReport, { now: NOW });
  const attachments = page.getByRole("region", { name: "Attached tool reports", exact: true });
  await attachments.getByLabel("Choose private report snapshot JSON", { exact: true }).setInputFiles({ name: "invalid-report.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...snapshot, publish: true, rawEmail: "UNTRUSTED CANARY" })) });
  await expect(attachments.getByRole("alert")).toBeVisible();
  await expect(attachments.getByRole("button", { name: "Attach report to attempt", exact: true })).toHaveCount(0);
  expect(JSON.parse((await downloadText(page, "Download full JSON backup")).text)).toEqual(experiment);
});
