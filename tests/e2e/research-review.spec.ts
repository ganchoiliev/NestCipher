import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createAttempt, createSyntheticExperiment, duplicateAttempt, exportExperimentJson, withChallenge, type Experiment } from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });
const workbench = "/tools/research-workbench";
const captured = "2026-01-01T00:00:00.000Z";

function fixture() {
  const experiment = createSyntheticExperiment({ now: captured });
  experiment.title = "Invented research review";
  const baseline = experiment.attempts[0];
  baseline.conditions.target = "<img src='https://never-fetch.example.test/review'>";
  baseline.changeNote = "Baseline recorded for an invented exercise";
  baseline.input = "Exact Unicode:\tα\u200b\r\n<script>window.reviewExecuted=true</script>";
  baseline.executionState = "recorded";
  baseline.response = "Authored response with preserved spaces.\r\n  Second line.";
  baseline.assessment = "met";
  baseline.assessmentReason = "Manual assessment entered for the synthetic fixture.";
  baseline.actionsStatus = "none-observed";
  const variant = duplicateAttempt(baseline, { now: captured });
  variant.changeNote = "Only the invented prompt wording changes";
  variant.input = "UNTESTED_SEARCH_NEEDLE";
  const error = createAttempt({ ...baseline.conditions, target: "", criterion: "" }, { now: captured });
  error.changeNote = "Reported failure with context still missing";
  error.input = "This invented prompt was reported as a provider error.";
  error.executionState = "error";
  error.actionsStatus = "recorded";
  error.assessment = "not-met";
  const unstated = createAttempt(baseline.conditions, { now: captured });
  unstated.changeNote = "Observation entered before updating execution state";
  unstated.input = "Invented context review case";
  unstated.response = "Recorded text alone does not set a test state.";
  return withChallenge({ ...experiment, attempts: [baseline, variant, error, unstated] }, { name: "Invented restricted exercise", endsAt: "2026-10-01T12:00:00.000Z", endConfirmed: true }, captured);
}

async function load(page: Page, experiment = fixture()) {
  await page.goto(workbench);
  await expect(page.getByRole("button", { name: "Load synthetic example", exact: true })).toBeEnabled();
  await page.getByTestId("restore-experiment").setInputFiles({ name: "review-private.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(experiment)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(experiment.title);
  return experiment;
}

async function review(page: Page) {
  await page.getByRole("button", { name: "Review", exact: true }).click();
  return page.getByRole("region", { name: "Review the record.", exact: true });
}

async function backup(page: Page): Promise<Experiment> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full JSON backup", exact: true }).first().click();
  const path = await (await pending).path();
  return JSON.parse(await readFile(path!, "utf8"));
}

test("review filters manual states and prompt search without changing exact private records or sending requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (/never-fetch|plausible\.io|\/api\//.test(request.url())) requests.push(request.url()); });
  const original = await load(page);
  const panel = await review(page);
  await expect(panel.getByRole("status")).toHaveText("Showing 4 of 4 attempts · Experiment order");
  await expect(panel.getByRole("button", { name: /^Not tested/ })).toContainText("2");
  await expect(panel.getByRole("button", { name: /^Reported errors/ })).toContainText("1");
  await expect(panel.getByRole("button", { name: /^Unassessed/ })).toContainText("2");
  await panel.getByRole("button", { name: /^Not tested/ }).click();
  await expect(panel.getByTestId("review-attempt-1")).toHaveCount(0);
  await expect(panel.getByTestId("review-attempt-2")).toBeVisible();
  await expect(panel.getByTestId("review-attempt-4")).toBeVisible();
  await panel.getByLabel("Find an attempt", { exact: true }).fill("untested_search_needle");
  await expect(panel.getByRole("status")).toHaveText("Showing 1 of 4 attempts · Experiment order");
  await panel.getByRole("button", { name: "Reset view", exact: true }).click();
  await panel.getByRole("button", { name: /^Reported errors/ }).click();
  await expect(panel.getByTestId("review-attempt-3")).toBeVisible();
  await expect(panel.getByRole("status")).toHaveText("Showing 1 of 4 attempts · Experiment order");
  await panel.getByLabel("Find an attempt", { exact: true }).fill("no matching private text");
  await expect(panel.getByRole("heading", { name: "No attempts match this view.", exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Show all attempts", exact: true }).click();
  await panel.getByTestId("review-attempt-1").getByText("Read captured conditions", { exact: true }).click();
  await expect(panel.getByTestId("review-attempt-1").getByText(original.attempts[0].conditions.target, { exact: true })).toBeVisible();
  expect(await backup(page)).toEqual(original);
  expect(await page.evaluate(() => Object.hasOwn(window, "reviewExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("opening an attempt and comparing its parent preserve unsaved evidence, conditions and embargo", async ({ page }) => {
  const original = await load(page);
  await page.getByTestId("attempt-input").fill("Unsaved exact review draft\n  α\u200b");
  const before = await backup(page);
  const panel = await review(page);
  await panel.getByRole("button", { name: "Open Attempt 02", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attempt 02", exact: true })).toBeFocused();
  await expect(page.getByTestId("attempt-input")).toHaveValue(original.attempts[1].input);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await review(page);
  await page.getByRole("button", { name: "Compare Attempt 02 with Attempt 01", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Compare two attempts.", exact: true })).toBeFocused();
  await expect(page.getByLabel("Baseline attempt", { exact: true })).toHaveValue(original.attempts[0].id);
  await expect(page.getByLabel("Variant attempt", { exact: true })).toHaveValue(original.attempts[1].id);
  expect(await backup(page)).toEqual(before);
  expect(before.disclosure.publish).toBe(false);
  expect(before.disclosure.publicNotBefore).toBe("2026-10-31T12:00:00.000Z");
  await review(page);
  await page.getByRole("button", { name: "Open Attempt 01", exact: true }).click();
  await expect(page.getByTestId("attempt-input")).toHaveValue(before.attempts[0].input);
  await expect(page.getByTestId("storage-status")).toHaveText("Session only");
});

test("field checks expose missing snapshot context without altering researcher assessments", async ({ page }) => {
  const original = await load(page);
  const panel = await review(page);
  await panel.getByRole("button", { name: /^Needs context/ }).click();
  await expect(panel.getByTestId("review-attempt-1")).toHaveCount(0);
  await expect(panel.getByTestId("review-attempt-2")).toHaveCount(0);
  const error = panel.getByTestId("review-attempt-3");
  await error.locator("details").filter({ hasText: /field checks/ }).locator("summary").click();
  await expect(error).toContainText(/criterion/i);
  await expect(error).toContainText(/target/i);
  await expect(error).toContainText(/reason/i);
  await expect(error).toContainText("Did not meet criterion");
  const unset = panel.getByTestId("review-attempt-4");
  await unset.locator("details").filter({ hasText: /field check/ }).locator("summary").click();
  await expect(unset).toContainText(/Not tested/i);
  expect(await backup(page)).toEqual(original);
});

test("review does not autosave an edited encrypted-vault draft", async ({ page }) => {
  await load(page);
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Local vault.", exact: true });
  const phrase = "public review vault fixture passphrase";
  await library.getByLabel("New vault passphrase", { exact: true }).fill(phrase);
  await library.getByLabel("Confirm vault passphrase", { exact: true }).fill(phrase);
  await library.getByRole("button", { name: "Create vault", exact: true }).click();
  await expect(library.getByText(/Unlocked · 0 saved experiments/)).toBeVisible();
  await library.getByRole("button", { name: "Close library", exact: true }).click();
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByTestId("storage-status")).toContainText("Saved locally");
  await page.getByTestId("attempt-response").fill("New response retained only in the unsaved draft");
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  const before = await backup(page);
  const panel = await review(page);
  await panel.getByRole("button", { name: /^Unassessed/ }).click();
  await panel.getByRole("button", { name: "Reset view", exact: true }).click();
  await panel.getByRole("button", { name: "Open Attempt 01", exact: true }).click();
  expect(await backup(page)).toEqual(before);
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  await expect(page.getByTestId("attempt-response")).toHaveValue("New response retained only in the unsaved draft");
});

test("empty experiments and narrow keyboard filtering remain usable", async ({ page }) => {
  const original = { ...fixture(), attempts: [] };
  await load(page, original);
  const panel = await review(page);
  await expect(panel.getByRole("heading", { name: "No attempts yet.", exact: true })).toBeVisible();
  expect(await backup(page)).toEqual(original);
  await page.reload();
  await page.setViewportSize({ width: 320, height: 860 });
  await load(page);
  const narrow = await review(page);
  const views = page.getByRole("group", { name: "Workbench view", exact: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 860 });
    const tabs = await views.getByRole("button").evaluateAll((elements) => elements.map((element) => {
      const rectangle = element.getBoundingClientRect();
      return { width: rectangle.width, height: rectangle.height, top: rectangle.top, bottom: rectangle.bottom };
    }));
    expect(tabs).toHaveLength(4);
    expect(tabs.every((tab) => tab.width >= 44 && tab.height >= 44)).toBe(true);
    expect(Math.max(...tabs.map((tab) => tab.top)) - Math.min(...tabs.map((tab) => tab.top))).toBeLessThan(1);
    expect(Math.max(...tabs.map((tab) => tab.width)) - Math.min(...tabs.map((tab) => tab.width))).toBeLessThan(1);
    const newAttempt = await page.getByRole("button", { name: /^New attempt/ }).boundingBox();
    expect(newAttempt!.y).toBeGreaterThan(Math.max(...tabs.map((tab) => tab.bottom)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await views.getByRole("button", { name: "Compose", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(views.getByRole("button", { name: "Review", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(views.getByRole("button", { name: "Review", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 320, height: 860 });
  await narrow.getByRole("button", { name: /^Reported errors/ }).focus();
  await page.keyboard.press("Enter");
  await expect(narrow.getByRole("button", { name: /^Reported errors/ })).toHaveAttribute("aria-pressed", "true");
  await expect(narrow.getByTestId("review-attempt-3")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sizes = await narrow.locator("button, summary, input").evaluateAll((elements) => elements.filter((element) => element.getClientRects().length).map((element) => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
  expect(sizes.every((size) => size.width >= 44 && size.height >= 44)).toBe(true);
});
