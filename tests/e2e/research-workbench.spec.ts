import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  createSyntheticExperiment,
  exportExperimentJson,
  withChallenge,
} from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

const workbenchPath = "/tools/research-workbench";

function privateFixture() {
  const fixture = createSyntheticExperiment({ now: "2026-01-01T00:00:00.000Z" });
  fixture.title = "Private synthetic research fixture";
  fixture.attempts[0].input = "Unicode:\tα\u200b\r\n<script>window.fixtureExecuted = true</script>\r\n```\r\nhttps://never-fetch.example.test/evidence";
  fixture.attempts[0].response = "Captured response\r\n  Preserve these spaces.\r\n";
  fixture.attempts[0].acquisition.input = "imported";
  fixture.attempts[0].acquisition.response = "imported";
  return withChallenge(fixture, {
    name: "Synthetic restricted challenge",
    endsAt: "2026-10-01T12:00:00.000Z",
    endConfirmed: true,
  }, "2026-01-01T00:00:00.000Z");
}

async function openFixture(page: Page) {
  await page.goto(workbenchPath);
  await expect(page.getByRole("button", { name: "Load synthetic example", exact: true })).toBeEnabled();
  const fixture = privateFixture();
  await page.getByTestId("restore-experiment").setInputFiles({
    name: "private-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportExperimentJson(fixture)),
  });
  await expect(page.getByTestId("experiment-title")).toHaveValue(fixture.title);
  return fixture;
}

async function downloadText(page: Page, buttonName: string) {
  const downloadPromise = page.waitForEvent("download");
  // The same full-backup action appears in the session bar and export panel.
  await page.getByRole("button", { name: buttonName, exact: true }).first().click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!, "utf8");
}

async function expectPrivateDocument(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Research Workbench/i);
  const documentUrl = await page.evaluate(() =>
    performance.getEntriesByType("navigation").map((entry) => entry.name),
  );
  expect(documentUrl).toHaveLength(1);
  expect(new URL(documentUrl[0]).pathname).toBe(workbenchPath);
  await expect(page.locator('script[src*="plausible.io"], script#plausible-init')).toHaveCount(0);
}

test("workbench gets a fresh private document from the catalog and leaves through document navigation", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/tools");
  await expect(page.locator('script[src*="plausible.io"]')).toHaveCount(1);
  requests.length = 0;
  await page.getByRole("main").getByRole("link", { name: /Research Workbench/ }).click();
  await expectPrivateDocument(page);
  expect(requests.filter((url) => /plausible\.io|\/api\/|\/\.well-known\/vercel|\/challenge\.v2/.test(url))).toEqual([]);
  await page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Tools", exact: true }).click();
  await expect(page).toHaveURL(/\/tools$/);
  const navigationPath = await page.evaluate(() =>
    new URL(performance.getEntriesByType("navigation")[0].name).pathname,
  );
  expect(navigationPath).toBe("/tools");
});

test("workspace CSP omits analytics without weakening the nonce policy, and inbound flags cannot suppress public analytics", async ({ page, request }) => {
  const response = await page.goto(workbenchPath);
  expect(response).not.toBeNull();
  const csp = response!.headers()["content-security-policy"];
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toMatch(/'nonce-[^']+'/);
  expect(csp).toContain("connect-src 'self'");
  expect(csp).not.toContain("plausible.io");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).toContain("frame-ancestors 'none'");
  await expectPrivateDocument(page);

  const publicResponse = await request.get("/tools", { headers: { "x-nestcipher-workbench": "1" } });
  expect(publicResponse.ok()).toBeTruthy();
  expect(await publicResponse.text()).toContain("https://plausible.io/js/");
  const workspaceResponse = await request.get(workbenchPath, { headers: { "x-nestcipher-workbench": "0" } });
  expect(workspaceResponse.ok()).toBeTruthy();
  expect(await workspaceResponse.text()).not.toContain("https://plausible.io/js/");
  // Document prefetch headers used to exclude a request from the proxy matcher.
  const prefetchResponse = await request.get("/tools", { headers: { "x-nestcipher-workbench": "1", purpose: "prefetch" } });
  expect(prefetchResponse.ok()).toBeTruthy();
  expect(await prefetchResponse.text()).toContain("https://plausible.io/js/");
});

test("private imports preserve exact evidence and the embargo through actual downloads", async ({ page }) => {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    if (/never-fetch\.example|plausible\.io|\/api\//.test(request.url())) unexpected.push(request.url());
  });
  const fixture = await openFixture(page);
  await expect(page.getByTestId("attempt-input")).toHaveValue(fixture.attempts[0].input.replace(/\r\n/g, "\n"));
  const backup = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(backup).toEqual(fixture);
  expect(backup.attempts[0].input).toContain("\r\n");
  expect(backup.disclosure.publicNotBefore).toBe("2026-10-31T12:00:00.000Z");
  expect(backup.disclosure.visibility).toBe("private");
  expect(backup.disclosure.publish).toBe(false);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const markdown = await downloadText(page, "Download private Markdown");
  expect(markdown).toContain("publish: false");
  expect(markdown).toContain("2026-10-31T12:00:00.000Z");
  expect(markdown).toContain("<script>window.fixtureExecuted = true</script>");
  expect(markdown).toContain("````text");
  expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "fixtureExecuted"))).toBe(false);
  expect(unexpected).toEqual([]);

  const inputOption = page.getByRole("region", { name: "Carry the record forward.", exact: true }).getByRole("checkbox", { name: "Prompt input", exact: true });
  await inputOption.uncheck();
  const abbreviated = await downloadText(page, "Download private Markdown");
  expect(abbreviated).toContain("[Omitted from this private Markdown export.]");
  expect(abbreviated).not.toContain("window.fixtureExecuted");
  expect(JSON.parse(await downloadText(page, "Download full JSON backup"))).toEqual(fixture);
});

test("a variant clears results and preserves its parent's conditions when experiment defaults change", async ({ page }) => {
  const fixture = await openFixture(page);
  await page.getByRole("button", { name: "Use as next attempt", exact: true }).click();
  await expect(page.getByTestId("attempt-response")).toHaveValue("");
  await expect(page.getByLabel("Execution state (reported)", { exact: true })).toHaveValue("not-tested");
  await expect(page.getByLabel("Researcher assessment", { exact: true })).toHaveValue("unassessed");
  await expect(page.getByLabel("Tool action observation", { exact: true })).toHaveValue("not-recorded");
  const input = "Browser-edited variant\n  Preserve indentation.\u200b";
  await page.getByTestId("attempt-input").fill(input);

  const defaults = page.locator("details").filter({ has: page.getByText("Edit experiment defaults", { exact: true }) });
  if (!(await defaults.evaluate((element) => (element as HTMLDetailsElement).open))) await defaults.getByText("Edit experiment defaults", { exact: true }).click();
  await page.getByTestId("defaults-target").fill("A different default target");
  const backup = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(backup.attempts).toHaveLength(3);
  expect(backup.attempts[2].parentId).toBe(fixture.attempts[0].id);
  expect(backup.attempts[2].conditions).toEqual(fixture.attempts[0].conditions);
  expect(backup.attempts[0]).toEqual(fixture.attempts[0]);
  expect(backup.attempts[2].input).toBe(input);
  expect(backup.attempts[2].acquisition.input).toBe("browser-edited");
  expect(backup.attempts[2].reportedTestAt).toBeNull();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare two attempts.", exact: true })).toBeVisible();
  await expect(page.getByText(input, { exact: true })).toBeVisible();
});

test("invalid restores and cancelled replacements preserve the current draft", async ({ page }) => {
  await openFixture(page);
  const draft = "An unsaved private draft";
  await page.getByTestId("attempt-input").fill(draft);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "wrong-version.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ schemaVersion: 999 })) });
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("attempt-input")).toHaveValue(draft);
  await page.getByRole("button", { name: "New experiment", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Keep current session", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("attempt-input")).toHaveValue(draft);
  const backup = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(backup.attempts[0].input).toBe(draft);
});

test("oversized evidence is rejected visibly without silently shortening the captured record", async ({ page }) => {
  const fixture = await openFixture(page);
  await page.getByTestId("attempt-input").fill("x".repeat(100_001));
  await expect(page.getByTestId("attempt-input")).toHaveValue(fixture.attempts[0].input.replace(/\r\n/g, "\n"));
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  const backup = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(backup.attempts[0]).toEqual(fixture.attempts[0]);
});

test("deleting a parent clears its variant reference while preserving the variant evidence", async ({ page }) => {
  const fixture = await openFixture(page);
  await page.getByRole("button", { name: "Delete attempt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete this attempt", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("main").getByRole("status")).toContainText("no parent reference now");
  const backup = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(backup.attempts).toHaveLength(1);
  const expected = { ...fixture.attempts[1], parentId: null };
  const remaining = { ...backup.attempts[0], updatedAt: expected.updatedAt };
  expect(remaining).toEqual(expected);
});

test("changing a challenge end resets confirmation before deriving a new disclosure date", async ({ page }) => {
  await openFixture(page);
  await page.locator("summary").filter({ hasText: "Challenge disclosure" }).click();
  // Chromium normalizes zero seconds away before Playwright's value check.
  await page.getByLabel("Challenge end time (UTC, optional)", { exact: true }).fill("2026-10-02T12:00");
  const confirmed = page.getByRole("checkbox", { name: "I have confirmed the challenge ended at this time.", exact: true });
  await expect(confirmed).not.toBeChecked();
  const unconfirmed = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(unconfirmed.disclosure.challenge.endsAt).toBe("2026-10-02T12:00:00.000Z");
  expect(unconfirmed.disclosure.publicNotBefore).toBeNull();
  await confirmed.check();
  const confirmedBackup = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(confirmedBackup.disclosure.publicNotBefore).toBe("2026-11-01T12:00:00.000Z");
  expect(confirmedBackup.disclosure.publish).toBe(false);
});

test("the first new attempt captures experiment defaults and a partial setup can be backed up", async ({ page }) => {
  await page.goto(workbenchPath);
  await page.getByRole("button", { name: /Start an experiment/ }).click();
  await page.getByTestId("experiment-title").fill("A private setup before testing");
  await page.getByTestId("defaults-question").fill("Does the target preserve the requested boundary?");
  await page.getByTestId("defaults-target").fill("Manually supplied target");
  const partial = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(partial.title).toBe("A private setup before testing");
  expect(partial.attempts).toHaveLength(0);
  await page.getByRole("button", { name: "New attempt", exact: true }).click();
  await page.getByTestId("attempt-input").fill("An exact manually drafted prompt");
  const complete = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(complete.attempts).toHaveLength(1);
  expect(complete.attempts[0].conditions).toEqual(partial.defaults);
  expect(complete.attempts[0].executionState).toBe("not-tested");
  expect(complete.disclosure.publicNotBefore).toBeNull();
});
