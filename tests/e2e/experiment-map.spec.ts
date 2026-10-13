import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createEmailReportSnapshot } from "../../src/lib/research-report";
import {
  createAttempt, createExperiment, duplicateAttempt, exportExperimentJson, withChallenge,
  type Attempt, type Experiment,
} from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

const route = "/tools/research-workbench";
const captured = "2026-01-01T00:00:00.000Z";
const phrase = "public synthetic experiment map vault phrase";
const exactInput = "OMIT_INPUT_DATA\r\n  α\u200b<script>window.mapExecuted=true</script>\nhttps://never-fetch.example.test/map-input";
const omittedMarkers = [
  "OMIT_INPUT_DATA", "OMIT_QUESTION_DATA", "OMIT_SCOPE_DATA", "OMIT_CRITERION_DATA", "OMIT_CONTEXT_DATA",
  "OMIT_PLACEMENT_DATA", "OMIT_RESPONSE_DATA", "OMIT_ACTION_DATA", "OMIT_ERROR_DATA", "OMIT_NOTES_DATA",
  "OMIT_REASON_DATA", "OMIT_CHANGE_DATA", "OMIT_REPORT_DATA", "OMIT_TAG_DATA",
];

function watchResearchRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!new Set(["localhost", "127.0.0.1"]).has(url.hostname) || /\/api\/|never-fetch|plausible\.io/.test(url.href)) requests.push(url.href);
  });
  return requests;
}

function baseExperiment(): Experiment {
  const experiment = createExperiment({ now: captured });
  experiment.title = "Invented experiment map";
  experiment.defaults = {
    question: "OMIT_QUESTION_DATA", scope: "OMIT_SCOPE_DATA", target: "", modelVersion: "",
    criterion: "OMIT_CRITERION_DATA", settings: " \t ", context: "OMIT_CONTEXT_DATA",
  };
  const baseline = createAttempt(experiment.defaults, { now: captured });
  baseline.input = exactInput;
  baseline.inputPlacement = "OMIT_PLACEMENT_DATA";
  baseline.changeNote = "OMIT_CHANGE_DATA";
  baseline.response = "OMIT_RESPONSE_DATA";
  baseline.actions = "OMIT_ACTION_DATA";
  baseline.actionsStatus = "recorded";
  baseline.executionState = "recorded";
  baseline.executionError = "OMIT_ERROR_DATA";
  baseline.assessment = "met";
  baseline.assessmentReason = "OMIT_REASON_DATA";
  baseline.notes = "OMIT_NOTES_DATA";
  baseline.reportedTestAt = captured;
  baseline.reportSnapshots = [createEmailReportSnapshot({
    overallScore: 42, overallLevel: "medium", verdict: "OMIT_REPORT_DATA",
    categories: [{ name: "Authored fixture", score: 42, level: "medium", findings: ["OMIT_REPORT_DATA"], explanation: "OMIT_REPORT_DATA" }],
    suspiciousElements: [], recommendations: ["OMIT_REPORT_DATA"], summary: "OMIT_REPORT_DATA", analysedAt: captured,
  }, { now: captured })];
  experiment.attempts = [baseline];
  experiment.tags = ["OMIT_TAG_DATA"];
  return withChallenge(experiment, { name: "Invented restricted map exercise", endsAt: "2026-10-01T12:00:00.000Z", endConfirmed: true }, captured);
}

function groupedExperiment(): Experiment {
  const experiment = baseExperiment();
  const baseline = experiment.attempts[0];
  const recorded = duplicateAttempt(baseline, { now: captured });
  recorded.executionState = "recorded";
  recorded.response = "Second authored response";
  recorded.assessment = "not-met";
  recorded.assessmentReason = "Second authored manual reasoning";
  const error = duplicateAttempt(baseline, { now: captured });
  error.executionState = "error";
  error.executionError = "An authored reported error";
  error.assessment = "met";
  error.assessmentReason = "Contradictory entered assessment to inspect";
  const untested = duplicateAttempt(baseline, { now: captured });
  untested.assessment = "not-met";
  untested.assessmentReason = "Another contradictory entry; no test state recorded";
  const emptyRecorded = duplicateAttempt(baseline, { now: captured });
  emptyRecorded.executionState = "recorded";
  const variants: Attempt[] = Array.from({ length: 5 }, () => duplicateAttempt(baseline, { now: captured }));
  variants[0].input = exactInput.replace("\r\n", "\n");
  variants[1].input = `${exactInput}\u200b`;
  variants[2].inputPlacement = "Different entered placement";
  variants[3].conditions.target = "Different entered target";
  variants[4].conditions.context = `${baseline.conditions.context}\u200b`;
  experiment.attempts = [baseline, recorded, error, untested, emptyRecorded, ...variants];
  return experiment;
}

function reorderedExperiment(): Experiment {
  const experiment = baseExperiment();
  const baseline = experiment.attempts[0];
  const child = duplicateAttempt(baseline, { now: captured });
  child.input = "Authored child input";
  const descendant = duplicateAttempt(child, { now: captured });
  descendant.input = "Authored descendant input";
  const secondRoot = createAttempt(experiment.defaults, { now: captured });
  secondRoot.input = "An independent authored root";
  experiment.attempts = [descendant, secondRoot, baseline, child];
  return experiment;
}

async function importRecord(page: Page, experiment: Experiment) {
  await page.getByTestId("restore-experiment").setInputFiles({ name: "synthetic-map.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(experiment)) });
}

async function load(page: Page, experiment = baseExperiment()) {
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Load synthetic example", exact: true })).toBeEnabled();
  await importRecord(page, experiment);
  await expect(page.getByTestId("experiment-title")).toHaveValue(experiment.title);
  return experiment;
}

async function map(page: Page) {
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Experiment map", exact: true }).click();
  const region = page.getByRole("region", { name: "Trace the experiment.", exact: true });
  await expect(region).toBeVisible();
  return region;
}

async function download(page: Page, name: string, region: Locator = page.locator("body")): Promise<string> {
  const waiting = page.waitForEvent("download");
  await region.getByRole("button", { name, exact: true }).first().click();
  const path = await (await waiting).path();
  expect(path).not.toBeNull();
  return readFile(path!, "utf8");
}

async function backup(page: Page): Promise<Experiment> {
  return JSON.parse(await download(page, "Download full JSON backup"));
}

async function createVault(page: Page) {
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Vault & backup", exact: true });
  await panel.getByRole("button", { name: "Create a new vault", exact: true }).click();
  await panel.getByLabel("New vault passphrase", { exact: true }).fill(phrase);
  await panel.getByLabel("Confirm vault passphrase", { exact: true }).fill(phrase);
  await panel.getByRole("button", { name: "Create vault", exact: true }).click();
  await expect(panel.getByText(/Unlocked · 0 saved experiments/)).toBeVisible();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByTestId("storage-status")).toContainText("Saved locally");
}

function readZip(bytes: Buffer): Map<string, string> {
  const end = bytes.length - 22;
  expect(bytes.readUInt32LE(end)).toBe(0x06054b50);
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let index = 0; index < count; index++) {
    expect(bytes.readUInt32LE(offset)).toBe(0x02014b50);
    expect(bytes.readUInt16LE(offset + 10)).toBe(0);
    const length = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    expect(bytes.readUInt32LE(localOffset)).toBe(0x04034b50);
    const body = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    files.set(name, bytes.subarray(body, body + length).toString("utf8"));
    offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  return files;
}

test("lineage traces reordered parents and multiple roots without changing the working record", async ({ page }) => {
  const requests = watchResearchRequests(page);
  const original = await load(page, reorderedExperiment());
  await page.getByTestId("attempt-notes").fill("An unsaved authored map note");
  const before = await backup(page);
  const panel = await map(page);
  const order = await panel.getByRole("list", { name: "Experiment lineage", exact: true }).getByRole("button", { name: /^Select Attempt/ }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-testid")));
  expect(order).toEqual([original.attempts[1], original.attempts[2], original.attempts[3], original.attempts[0]].map((attempt) => `map-attempt-${attempt.id}`));
  await panel.getByRole("button", { name: "Select Attempt 01", exact: true }).click();
  const selected = panel.getByRole("region", { name: "Selected attempt", exact: true });
  await expect(selected).toContainText(original.attempts[0].id);
  await expect(selected).toContainText("Attempt 04");
  await selected.getByRole("button", { name: "Open Attempt 01", exact: true }).click();
  await expect(page.getByTestId("attempt-input")).toHaveValue(original.attempts[0].input);
  const again = await map(page);
  await again.getByRole("button", { name: "Select Attempt 01", exact: true }).click();
  await again.getByRole("button", { name: "Compare Attempt 01 with Attempt 04", exact: true }).click();
  await expect(page.getByLabel("Baseline attempt", { exact: true })).toHaveValue(original.attempts[3].id);
  await expect(page.getByLabel("Variant attempt", { exact: true })).toHaveValue(original.attempts[0].id);
  expect(await backup(page)).toEqual(before);
  await expect(page.getByTestId("storage-status")).toHaveText("Session only");
  expect(requests).toEqual([]);
});

test("captured groups split exact changed bytes and conditions while retaining unknowns and manual state distinctions", async ({ page }) => {
  const original = await load(page, groupedExperiment());
  const panel = await map(page);
  await panel.getByRole("button", { name: /^Captured input groups/ }).click();
  const groupButtons = panel.getByRole("button", { name: /^Select captured input group/ });
  await expect(groupButtons).toHaveCount(6);
  await panel.getByTestId(`captured-group-${original.attempts[0].id}`).click();
  const selected = panel.getByRole("region", { name: "Selected captured input group", exact: true });
  await expect(selected).toContainText("Target");
  await expect(selected).toContainText("Model / version");
  await expect(selected).toContainText("Settings");
  for (const [label, expected] of [["Attempt records", "5"], ["Not tested", "1"], ["Recorded-state attempts", "3"], ["Reported errors", "1"], ["Met criterion", "1"], ["Did not meet criterion", "1"], ["Unassessed", "1"], ["Inconclusive", "0"]]) {
    await expect(selected.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd")).toHaveText(expected);
  }
  await expect(selected).toContainText("2 assessments outside recorded-state attempts");
  await expect(selected).toContainText("Recorded attempt has no response or action observation");
  await expect(selected).toContainText("State is not tested; review recorded test information");
  for (const attempt of original.attempts.slice(0, 5)) await expect(selected).toContainText(attempt.id);
  await expect(selected).not.toContainText(original.attempts[5].id);
  const summary = await download(page, "Download private results note", await previewResults(panel));
  const firstGroup = summary.split("### Group 01")[1].split("### Group 02")[0];
  expect(firstGroup).toContain("Total attempts: 5");
  expect(firstGroup).toContain("Not tested (reported): 1");
  expect(firstGroup).toContain("Recorded-state attempts (reported): 3");
  expect(firstGroup).toContain("Execution / provider errors (reported): 1");
  expect(firstGroup).toContain("1 met criterion; 1 did not meet criterion; 0 inconclusive; 1 unassessed");
  expect(firstGroup).toContain("excluded from recorded-state assessment counts: 2");
  expect(firstGroup).toContain("Missing captured fields: Target; Model / version; Settings");
  expect(await backup(page)).toEqual(original);
});

async function previewResults(panel: Locator): Promise<Locator> {
  await panel.getByRole("button", { name: "Preview private results note", exact: true }).click();
  await expect(panel.getByLabel("Private results note preview", { exact: true })).toBeVisible();
  return panel;
}

test("the private results preview and download expose only the reviewed summary snapshot", async ({ page }) => {
  const requests = watchResearchRequests(page);
  const original = await load(page);
  await createVault(page);
  await save(page);
  await page.getByTestId("attempt-response").fill("OMIT_RESPONSE_DATA newer unsaved observation");
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  const before = await backup(page);
  const panel = await map(page);
  await expect(panel.getByRole("button", { name: "Download private results note", exact: true })).toHaveCount(0);
  await previewResults(panel);
  const preview = await panel.getByLabel("Private results note preview", { exact: true }).textContent();
  const summary = await download(page, "Download private results note", panel);
  expect(summary).toBe(preview);
  expect(summary).toContain(original.title);
  expect(summary).toContain(original.id);
  expect(summary).toContain(original.attempts[0].id);
  expect(summary).toContain("visibility: private");
  expect(summary).toContain("publish: false");
  expect(summary).toContain("2026-10-31T12:00:00.000Z");
  expect(summary).toContain("30 full days");
  expect(summary).toContain("not a lossless backup or restore archive");
  for (const marker of omittedMarkers) expect(summary).not.toContain(marker);
  expect(await backup(page)).toEqual(before);
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  expect(await page.evaluate(() => Object.hasOwn(window, "mapExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("editing, leaving and replacing the experiment remove the prepared results preview", async ({ page }) => {
  const original = await load(page);
  const panel = await map(page);
  await previewResults(panel);
  await page.getByTestId("experiment-title").fill("Edited invented map snapshot");
  await expect(panel.getByLabel("Private results note preview", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Download private results note", exact: true })).toHaveCount(0);
  await previewResults(panel);
  await expect(panel.getByLabel("Private results note preview", { exact: true })).toContainText("Edited invented map snapshot");
  await page.getByRole("button", { name: "Attempt review", exact: true }).click();
  await expect(page.getByLabel("Private results note preview", { exact: true })).toHaveCount(0);
  const reopened = await map(page);
  await expect(reopened.getByRole("button", { name: "Download private results note", exact: true })).toHaveCount(0);
  await previewResults(reopened);
  const replacement = { ...original, id: crypto.randomUUID(), title: "Independent replacement map snapshot" };
  await importRecord(page, replacement);
  const guard = page.getByRole("dialog", { name: "Restore this private JSON backup", exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Replace current session", exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveValue(replacement.title);
  const fresh = await map(page);
  await expect(fresh.getByLabel("Private results note preview", { exact: true })).toHaveCount(0);
  await expect(fresh.getByRole("button", { name: "Download private results note", exact: true })).toHaveCount(0);
});

test("locking clears map identifiers and results plaintext without changing the saved record", async ({ page }) => {
  const original = await load(page);
  await createVault(page);
  await save(page);
  const panel = await map(page);
  await previewResults(panel);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Trace the experiment.", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Private results note preview", { exact: true })).toHaveCount(0);
  const body = await page.locator("body").textContent();
  expect(body).not.toContain(original.id);
  expect(body).not.toContain(original.attempts[0].id);
  expect(body).not.toContain(original.title);
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const vault = page.getByRole("dialog", { name: "Vault & backup", exact: true });
  await vault.getByLabel("Vault passphrase", { exact: true }).fill(phrase);
  await vault.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await vault.getByRole("button", { name: `Open saved experiment ${original.title}`, exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveValue(original.title);
  expect(await backup(page)).toEqual(original);
  const fresh = await map(page);
  await expect(fresh.getByLabel("Private results note preview", { exact: true })).toHaveCount(0);
});

test("preparing a next attempt copies exact input and conditions but clears all outcomes, then saves and exports explicitly", async ({ page }) => {
  const requests = watchResearchRequests(page);
  const original = await load(page);
  await createVault(page);
  await save(page);
  const panel = await map(page);
  await panel.getByRole("button", { name: "Select Attempt 01", exact: true }).click();
  await panel.getByRole("button", { name: "Use Attempt 01 as next attempt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Attempt 02", exact: true })).toBeVisible();
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  const prepared = await backup(page);
  const next = prepared.attempts[1];
  expect(next.id).not.toBe(original.attempts[0].id);
  expect(next.parentId).toBe(original.attempts[0].id);
  expect(next.input).toBe(original.attempts[0].input);
  expect(next.inputPlacement).toBe(original.attempts[0].inputPlacement);
  expect(next.conditions).toEqual(original.attempts[0].conditions);
  expect(next).toMatchObject({
    response: "", actions: "", executionError: "", assessmentReason: "", notes: "", changeNote: "",
    executionState: "not-tested", assessment: "unassessed", actionsStatus: "not-recorded", reportedTestAt: null,
  });
  expect(next.reportSnapshots).toBeUndefined();
  expect(prepared.attempts[0]).toEqual(original.attempts[0]);
  await save(page);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const vault = page.getByRole("dialog", { name: "Vault & backup", exact: true });
  await vault.getByLabel("Vault passphrase", { exact: true }).fill(phrase);
  await vault.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await vault.getByRole("button", { name: `Open saved experiment ${original.title}`, exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveValue(original.title);
  expect(await backup(page)).toEqual(prepared);
  await page.getByRole("button", { name: "Research library", exact: true }).click();
  const library = page.getByRole("region", { name: "Research library", exact: true });
  await library.getByRole("checkbox", { name: `Select ${original.title}`, exact: true }).check();
  await library.getByRole("button", { name: "Preview Obsidian pack", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await library.getByRole("button", { name: "Download Obsidian pack", exact: true }).click();
  const files = readZip(await readFile((await (await downloading).path())!));
  const note = files.get(`experiments/${original.id}.md`)!;
  expect(note).toContain(next.id);
  expect(note).toContain(next.parentId!);
  expect(note).toContain(next.input);
  expect(note).toContain("not-tested");
  expect(note).toContain("publish: false");
  expect(requests).toEqual([]);
});

test("empty maps and a single root do not invent parents, groups or recorded outcomes", async ({ page }) => {
  const empty = { ...baseExperiment(), attempts: [] };
  await load(page, empty);
  const panel = await map(page);
  await expect(panel.getByRole("button", { name: /^Select Attempt/ })).toHaveCount(0);
  await panel.getByRole("button", { name: /^Captured input groups/ }).click();
  await expect(panel.getByRole("button", { name: /^Select captured input group/ })).toHaveCount(0);
  await previewResults(panel);
  const zero = await download(page, "Download private results note", panel);
  expect(zero).toContain("Total attempts: 0");
  expect(zero).toContain("No attempts in this snapshot");
  expect(zero).toContain("No captured-input groups in this snapshot");
  expect(await backup(page)).toEqual(empty);
  const single = baseExperiment();
  single.attempts = [duplicateAttempt(single.attempts[0], { now: captured })];
  single.attempts[0].parentId = null;
  await importRecord(page, single);
  await expect(page.getByTestId("experiment-title")).toHaveValue(single.title);
  const root = await map(page);
  await expect(root.getByRole("button", { name: "Select Attempt 01", exact: true })).toBeVisible();
  await expect(root.getByRole("button", { name: /^Compare Attempt/ })).toHaveCount(0);
  await previewResults(root);
  const note = await download(page, "Download private results note", root);
  expect(note).toContain("Recorded-state attempts (reported): 0");
  expect(note).toContain("Not tested (reported): 1");
});

test("deep lineages and long inert text remain keyboard accessible at 320px in both themes", async ({ page }) => {
  const requests = watchResearchRequests(page);
  await page.setViewportSize({ width: 320, height: 860 });
  const experiment = baseExperiment();
  experiment.defaults.target = `<img src='https://never-fetch.example.test/long-map'>${"LongTarget".repeat(190)}`;
  const root = createAttempt(experiment.defaults, { now: captured });
  root.input = exactInput;
  const chain = [root];
  for (let index = 1; index < 100; index++) chain.push(duplicateAttempt(chain[index - 1], { now: captured }));
  experiment.attempts = chain;
  await load(page, experiment);
  const panel = await map(page);
  await expect(panel.getByRole("button", { name: /^Select Attempt/ })).toHaveCount(100);
  const last = panel.getByRole("button", { name: "Select Attempt 100", exact: true });
  await last.focus();
  await page.keyboard.press("Enter");
  await expect(last).toHaveAttribute("aria-pressed", "true");
  const selected = panel.getByRole("region", { name: "Selected attempt", exact: true });
  await expect(selected).toContainText(chain[99].id);
  await selected.getByText("Read all captured conditions", { exact: true }).click();
  await expect(selected.getByLabel("Captured target", { exact: true })).toBeVisible();
  await expect(selected).toContainText(experiment.defaults.target);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => { document.documentElement.classList.toggle("dark", value === "dark"); document.documentElement.style.colorScheme = value; }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const groups = panel.getByRole("button", { name: /^Captured input groups/ });
    await groups.focus();
    await page.keyboard.press("Space");
    await expect(groups).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Select captured input group 01", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("region", { name: "Selected captured input group", exact: true })).toContainText("100");
    await previewResults(panel);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const sizes = await panel.locator("button").evaluateAll((buttons) => buttons.filter((button) => button.getClientRects().length).map((button) => { const box = button.getBoundingClientRect(); return { width: box.width, height: box.height }; }));
    expect(sizes.every((size) => size.width >= 44 && size.height >= 44)).toBe(true);
    await panel.getByRole("button", { name: /^Lineage/ }).click();
  }
  expect(await page.evaluate(() => Object.hasOwn(window, "mapExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});
