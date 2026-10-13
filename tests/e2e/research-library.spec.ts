import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSyntheticExperiment, exportExperimentJson, type Experiment } from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });
const route = "/tools/research-workbench";
const phrase = "public synthetic library test phrase";

function fixture(title: string, target: string, tags: string[], marker: string): Experiment {
  const experiment = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  experiment.title = title;
  experiment.tags = tags;
  experiment.defaults.target = target;
  experiment.attempts.forEach((attempt) => { attempt.conditions.target = target; });
  experiment.attempts[0].input = `Exact saved input ${marker}\r\n\u200b<script>window.libraryExecuted=true</script>`;
  experiment.attempts[0].response = `Exact saved response ${marker}`;
  experiment.disclosure.challenge.name = "Synthetic scoped challenge";
  return experiment;
}

async function importRecord(page: Page, experiment: Experiment) {
  await page.getByTestId("restore-experiment").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(experiment)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(experiment.title);
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

async function library(page: Page) {
  await page.getByRole("button", { name: "Research library", exact: true }).click();
  const region = page.getByRole("region", { name: "Research library", exact: true });
  await expect(region.getByRole("heading", { name: "Research library", exact: true })).toBeVisible();
  return region;
}

async function twoRecords(page: Page) {
  const first = fixture("Source boundaries", "Model Alpha", ["authority"], "ALPHA_SAVED_MARKER");
  const second = fixture("Controlled comparison", "Model Beta", ["comparison"], "BETA_SAVED_MARKER");
  first.attempts[0].conditions.target = "Historical Alpha";
  await page.goto(route);
  await importRecord(page, first);
  await createVault(page);
  await save(page);
  await importRecord(page, second);
  await save(page);
  return { first, second };
}

// Read the downloaded archive's central directory independently of the encoder.
// STORE archives have no compression; checksums/interoperability are verified by unit/CLI checks.
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
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    expect(bytes.readUInt32LE(localOffset)).toBe(0x04034b50);
    const body = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    files.set(name, bytes.subarray(body, body + length).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test("saved research supports local evidence search, intersecting filters and explicit tag saving", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (/\/api\/|plausible\.io/.test(request.url())) requests.push(request.url()); });
  const { first, second } = await twoRecords(page);
  await page.getByLabel("Experiment tags", { exact: true }).fill("unsaved-tag");
  await page.getByRole("button", { name: "Add tag", exact: true }).click();
  const region = await library(page);
  await expect(region.getByRole("button", { name: `Open saved experiment ${first.title}`, exact: true })).toBeVisible();
  await expect(region.getByRole("button", { name: `Open saved experiment ${second.title}`, exact: true })).toBeVisible();
  await expect(region.getByLabel("Tag", { exact: true }).getByRole("option", { name: "unsaved-tag", exact: true })).toHaveCount(0);
  await region.getByLabel("Search saved research", { exact: true }).fill("alpha_saved_marker");
  await expect(region.getByRole("button", { name: `Open saved experiment ${first.title}`, exact: true })).toBeVisible();
  await expect(region.getByRole("button", { name: `Open saved experiment ${second.title}`, exact: true })).toHaveCount(0);
  await region.getByLabel("Target", { exact: true }).selectOption({ label: "Historical Alpha" });
  await region.getByLabel("Tag", { exact: true }).selectOption({ label: "comparison" });
  await expect(region.getByRole("button", { name: /^Open saved experiment/ })).toHaveCount(0);
  await region.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await save(page);
  const updated = await library(page);
  await updated.getByLabel("Tag", { exact: true }).selectOption({ label: "unsaved-tag" });
  await expect(updated.getByRole("button", { name: `Open saved experiment ${second.title}`, exact: true })).toBeVisible();
  await expect(updated.getByRole("button", { name: `Open saved experiment ${first.title}`, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, "libraryExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("a selected linked Obsidian ZIP contains saved evidence and private policies, with explicit omissions", async ({ page }) => {
  const { first, second } = await twoRecords(page);
  await page.getByTestId("attempt-input").fill("UNSAVED_DRAFT_MUST_NOT_EXPORT");
  const region = await library(page);
  await region.getByRole("checkbox", { name: `Select ${first.title}`, exact: true }).check();
  await region.getByRole("checkbox", { name: `Select ${second.title}`, exact: true }).check();
  await region.getByRole("button", { name: "Preview Obsidian pack", exact: true }).click();
  await expect(region.getByLabel("Preview file", { exact: true })).toBeVisible();
  const waiting = page.waitForEvent("download");
  await region.getByRole("button", { name: "Download Obsidian pack", exact: true }).click();
  const files = readZip(await readFile((await (await waiting).path())!));
  expect([...files.keys()].sort()).toEqual(["README.md", "index.md", `experiments/${first.id}.md`, `experiments/${second.id}.md`].sort());
  expect(files.get("index.md")).toContain(`experiments/${first.id}.md`);
  expect(files.get("index.md")).toContain(`experiments/${second.id}.md`);
  expect(files.get(`experiments/${first.id}.md`)).toContain(first.attempts[0].input);
  expect(files.get(`experiments/${second.id}.md`)).toContain(second.attempts[0].input);
  for (const body of files.values()) expect(body).not.toContain("UNSAVED_DRAFT_MUST_NOT_EXPORT");
  expect(files.get(`experiments/${first.id}.md`)).toContain("publish: false");
  expect(files.get(`experiments/${first.id}.md`)).toContain("30 full days");
  await region.getByRole("checkbox", { name: "Prompt input", exact: true }).uncheck();
  await region.getByRole("button", { name: "Preview Obsidian pack", exact: true }).click();
  const omittedDownload = page.waitForEvent("download");
  await region.getByRole("button", { name: "Download Obsidian pack", exact: true }).click();
  const omitted = readZip(await readFile((await (await omittedDownload).path())!));
  expect(omitted.get(`experiments/${first.id}.md`)).not.toContain(first.attempts[0].input);
  expect(omitted.get(`experiments/${first.id}.md`)).toContain("[Omitted from this private Markdown export.]");
  // A response remains selected and still carries its independent marker.
  expect(omitted.get(`experiments/${first.id}.md`)).toContain(first.attempts[0].response);
});

test("opening saved research protects a newer working draft; locking removes library plaintext", async ({ page }) => {
  const { first } = await twoRecords(page);
  await page.getByTestId("attempt-input").fill("KEEP_THIS_NEWER_DRAFT");
  const region = await library(page);
  await region.getByLabel("Search saved research", { exact: true }).fill("alpha_saved_marker");
  await region.getByRole("checkbox", { name: `Select ${first.title}`, exact: true }).check();
  await region.getByRole("button", { name: `Open saved experiment ${first.title}`, exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Open this saved experiment", exact: true });
  await confirmation.getByRole("button", { name: "Keep current session", exact: true }).click();
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await expect(page.getByTestId("attempt-input")).toHaveValue("KEEP_THIS_NEWER_DRAFT");
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await page.getByRole("dialog", { name: "Lock vault and close this draft?", exact: true }).getByRole("button", { name: "Discard changes and lock", exact: true }).click();
  await expect(page.getByText(first.title, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Search saved research", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download Obsidian pack", exact: true })).toHaveCount(0);
  const locked = page.getByRole("region", { name: "Research library", exact: true });
  await locked.getByRole("button", { name: "Open vault", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Vault & backup", exact: true });
  await panel.getByLabel("Vault passphrase", { exact: true }).fill(phrase);
  await panel.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
  await expect(page.getByLabel("Search saved research", { exact: true })).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: `Select ${first.title}`, exact: true })).not.toBeChecked();
});

test("new-vault and restore paths are separate and switching clears new passphrases", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (/\/api\//.test(request.url())) requests.push(request.url()); });
  await page.goto(route);
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Vault & backup", exact: true });
  await expect(panel.getByLabel("New vault passphrase", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Create a new vault", exact: true }).click();
  await panel.getByLabel("New vault passphrase", { exact: true }).fill(phrase);
  await expect(panel.getByRole("button", { name: "Check account", exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Back to choices", exact: true }).click();
  await panel.getByRole("button", { name: "Restore an existing vault", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Check account", exact: true })).toBeVisible();
  await expect(panel.getByLabel("New vault passphrase", { exact: true })).toHaveCount(0);
  await panel.getByRole("button", { name: "Back to choices", exact: true }).click();
  await panel.getByRole("button", { name: "Create a new vault", exact: true }).click();
  await expect(panel.getByLabel("New vault passphrase", { exact: true })).toHaveValue("");
  expect(requests).toEqual([]);
});

test("partial saved research stays openable and explains why it cannot enter a Markdown pack", async ({ page }) => {
  const { first } = await twoRecords(page);
  const partial = { ...fixture("Partial research", "Model Gamma", ["draft"], "PARTIAL"), attempts: [] };
  await importRecord(page, partial);
  await save(page);
  const region = await library(page);
  await expect(region.getByRole("button", { name: `Open saved experiment ${partial.title}`, exact: true })).toBeEnabled();
  await expect(region.getByRole("checkbox", { name: `Select ${partial.title}`, exact: true })).toBeDisabled();
  await expect(region.getByText(/Add at least one attempt with input in Compose/)).toBeVisible();
  await region.getByRole("checkbox", { name: `Select ${first.title}`, exact: true }).check();
  await region.getByRole("button", { name: "Preview Obsidian pack", exact: true }).click();
  await expect(region.getByLabel("Preview file", { exact: true }).getByRole("option")).toHaveCount(3);
  await region.getByRole("button", { name: `Open saved experiment ${partial.title}`, exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveValue(partial.title);
  await expect(page.getByRole("button", { name: "Create first attempt from defaults", exact: true })).toBeVisible();
});

test("the saved library remains usable with keyboard filters at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const { first, second } = await twoRecords(page);
  const region = await library(page);
  const search = region.getByLabel("Search saved research", { exact: true });
  await search.focus();
  await page.keyboard.type("beta_saved_marker");
  await expect(region.getByRole("button", { name: `Open saved experiment ${second.title}`, exact: true })).toBeVisible();
  await expect(region.getByRole("button", { name: `Open saved experiment ${first.title}`, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await region.getByRole("checkbox", { name: `Select ${second.title}`, exact: true }).check();
  await region.getByRole("button", { name: "Preview Obsidian pack", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
