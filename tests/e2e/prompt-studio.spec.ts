import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSyntheticExperiment, exportExperimentJson, type Experiment } from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

const route = "/tools/research-workbench";
// Deliberately public fixtures; no real challenge prompts, credentials or research.
const phrase = "public synthetic prompt planning vault phrase";
const baseline = "SYNTHETIC_BASELINE_ONLY\n  Preserve spacing, α and \u200b.\n<script>window.planningExecuted=true</script>\nhttps://never-fetch.example.test/planned-input";
const firstVariant = "SYNTHETIC_VARIANT_ONE\n  Preserve its own spacing and \u200b.";
const secondVariant = "SYNTHETIC_VARIANT_TWO\n```quoted example```";
const plannedContext = "SYNTHETIC_CONTEXT_ONLY\n  Context entered for later manual testing.";

function watchResearchRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["fetch", "xhr"].includes(request.resourceType()) || !["localhost", "127.0.0.1"].includes(url.hostname) ||
        /plausible\.io|\/api\/|\/\.well-known\/vercel|\/challenge\.v2|never-fetch/.test(url.href)) requests.push(url.href);
  });
  page.on("websocket", (socket) => requests.push(socket.url()));
  return requests;
}

async function downloadText(page: Page, name: string, within: Locator = page.locator("body")) {
  const waiting = page.waitForEvent("download");
  await within.getByRole("button", { name, exact: true }).first().click();
  const path = await (await waiting).path();
  expect(path).not.toBeNull();
  return readFile(path!, "utf8");
}

async function backup(page: Page): Promise<Experiment> {
  return JSON.parse(await downloadText(page, "Download full JSON backup"));
}

async function openStudio(page: Page) {
  await page.getByRole("button", { name: "Plan an experiment", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toBeVisible();
}

async function fillPlan(page: Page, variantCount = 2) {
  await page.getByLabel("Plan title", { exact: false }).fill("Synthetic planning comparison");
  await page.getByLabel("Research question", { exact: false }).fill("Does an authored framing change alter the observable response?");
  await page.getByLabel("Observable criterion", { exact: false }).fill("Record whether the response retains the supplied synthetic label.");
  await page.getByLabel("Authorized scope", { exact: false }).fill("Invented local example only. No live challenge or provider execution.");
  await page.getByLabel("Baseline input", { exact: false }).fill(baseline);
  await page.getByLabel("Input placement", { exact: false }).fill("User message in a new synthetic conversation");
  await page.getByText("Record known conditions", { exact: true }).click();
  await page.getByLabel("Target", { exact: false }).fill("Synthetic target");
  await page.getByLabel("Model / version", { exact: false }).fill("Unknown — not guessed");
  await page.getByLabel("Known settings", { exact: false }).fill("Only entered settings are preserved");
  await page.getByLabel("Known context", { exact: false }).fill(plannedContext);
  for (let index = 1; index <= variantCount; index++) {
    await page.getByRole("button", { name: "Add variant", exact: true }).click();
    await page.getByLabel(`Variant ${index} input`, { exact: false }).fill(index === 1 ? firstVariant : secondVariant);
    await page.getByLabel(`Variant ${index} change`, { exact: false }).fill(`Change only the authored framing ${index}; retain baseline conditions.`);
  }
}

async function review(page: Page) {
  await page.getByRole("button", { name: "Review plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the experiment plan", exact: true })).toBeVisible();
}

async function prepare(page: Page, variantCount = 2) {
  await openStudio(page);
  await fillPlan(page, variantCount);
  await review(page);
  await page.getByRole("button", { name: "Prepare untested attempts", exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveValue("Synthetic planning comparison");
  await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toHaveCount(0);
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

async function reopen(page: Page, title: string) {
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Vault & backup", exact: true });
  await panel.getByLabel("Vault passphrase", { exact: true }).fill(phrase);
  await panel.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await panel.getByRole("button", { name: `Open saved experiment ${title}`, exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveValue(title);
}

test("reviewed baseline and variants become linked untested attempts without executing evidence", async ({ page }) => {
  const requests = watchResearchRequests(page);
  await page.goto(route);
  await openStudio(page);
  await fillPlan(page);
  await review(page);
  const reviewed: Experiment = JSON.parse(await downloadText(page, "Download reviewed research JSON"));
  await page.getByRole("button", { name: "Prepare untested attempts", exact: true }).click();
  await expect(page.getByTestId("storage-status")).toHaveText("Session only");
  await expect(page.getByRole("main").getByRole("status")).toContainText("3 untested attempts prepared");
  const prepared = await backup(page);
  expect(prepared).toEqual(reviewed);
  expect(prepared.title).toBe("Synthetic planning comparison");
  expect(prepared.attempts.map((attempt) => attempt.input)).toEqual([baseline, firstVariant, secondVariant]);
  expect(prepared.defaults).toMatchObject({
    question: "Does an authored framing change alter the observable response?",
    criterion: "Record whether the response retains the supplied synthetic label.",
    scope: "Invented local example only. No live challenge or provider execution.",
    target: "Synthetic target", modelVersion: "Unknown — not guessed",
    settings: "Only entered settings are preserved", context: plannedContext,
  });
  expect(new Set([prepared.id, ...prepared.attempts.map((attempt) => attempt.id)]).size).toBe(4);
  for (const [index, attempt] of prepared.attempts.entries()) {
    expect(attempt.parentId).toBe(index === 0 ? null : prepared.attempts[0].id);
    expect(attempt.conditions).toEqual(prepared.defaults);
    expect(attempt.inputPlacement).toBe("User message in a new synthetic conversation");
    expect(attempt).toMatchObject({
      response: "", actions: "", actionsStatus: "not-recorded", reportedTestAt: null,
      executionState: "not-tested", executionError: "", assessment: "unassessed", assessmentReason: "",
      authorship: "unspecified",
    });
    expect(attempt.reportSnapshots).toBeUndefined();
  }
  expect(prepared.disclosure).toMatchObject({ visibility: "private", publish: false, publicNotBefore: null, challenge: { endsAt: null, endConfirmed: false } });
  await page.getByRole("button", { name: "New experiment", exact: true }).click();
  const guard = page.getByRole("dialog", { name: "Start a new blank experiment", exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Keep current session", exact: true }).click();
  expect(await backup(page)).toEqual(prepared);
  expect(await page.evaluate(() => Object.hasOwn(window, "planningExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("handoff protects an existing unsaved experiment until its explicit replacement", async ({ page }) => {
  const existing = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  existing.title = "Existing synthetic working experiment";
  await page.goto(route);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "existing-synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(existing)) });
  await page.getByTestId("attempt-input").fill("UNSAVED_WORKING_EXPERIMENT\n  Exact evidence to keep.");
  const before = await backup(page);
  await openStudio(page);
  await fillPlan(page, 1);
  await review(page);
  const reviewed: Experiment = JSON.parse(await downloadText(page, "Download reviewed research JSON"));
  await page.getByRole("button", { name: "Prepare untested attempts", exact: true }).click();
  const guard = page.getByRole("dialog");
  await expect(guard).toBeVisible();
  const downloadedCurrent: Experiment = JSON.parse(await downloadText(page, "Download current backup", guard));
  expect(downloadedCurrent).toEqual(before);
  await guard.getByRole("button", { name: "Keep current session", exact: true }).click();
  await expect(guard).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Review the experiment plan", exact: true })).toBeVisible();
  expect(JSON.parse(await downloadText(page, "Download working experiment JSON"))).toEqual(before);
  expect(JSON.parse(await downloadText(page, "Download reviewed research JSON"))).toEqual(reviewed);
  await page.getByRole("button", { name: "Prepare untested attempts", exact: true }).click();
  await guard.getByRole("button", { name: "Replace current session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toHaveCount(0);
  expect(await backup(page)).toEqual(reviewed);
});

test("closing or pressing Escape protects the unsaved plan while retaining its working experiment", async ({ page }) => {
  const existing = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  existing.title = "Working document kept when planning closes";
  await page.goto(route);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "existing-synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(existing)) });
  await openStudio(page);
  await fillPlan(page, 1);
  await review(page);
  const reviewed = JSON.parse(await downloadText(page, "Download reviewed research JSON"));
  await page.getByRole("button", { name: "Close Prompt Studio", exact: true }).click();
  const guard = page.getByRole("dialog", { name: "Close Prompt Studio?", exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Keep current session", exact: true }).click();
  expect(JSON.parse(await downloadText(page, "Download reviewed research JSON"))).toEqual(reviewed);
  await page.keyboard.press("Escape");
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Discard plan and close", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toHaveCount(0);
  expect(await backup(page)).toEqual(existing);
  await openStudio(page);
  await expect(page.getByLabel("Plan title", { exact: false })).toHaveValue("");
  await expect(page.getByLabel("Baseline input", { exact: false })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Download reviewed research JSON", exact: true })).toHaveCount(0);
});

test("locking clears planning plaintext and reviewed handoffs while preserving the saved encrypted copy", async ({ page }) => {
  const existing = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  existing.title = "Saved copy protected by planning lock";
  existing.attempts[0].input = "ORIGINAL_SAVED_SYNTHETIC_INPUT";
  await page.goto(route);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "existing-synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(existing)) });
  await createVault(page);
  await save(page);
  await page.getByTestId("attempt-input").fill("UNSAVED_WORKING_INPUT_TO_PROTECT");
  const working = await backup(page);
  await openStudio(page);
  await fillPlan(page, 1);
  await page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true }).check();
  await page.getByLabel("Briefing goal", { exact: false }).fill("SYNTHETIC_BRIEFING_CLEAR_ON_LOCK");
  await page.getByRole("button", { name: "Preview briefing", exact: true }).click();
  await expect(page.getByLabel("Reviewed AI briefing text", { exact: true })).toContainText("SYNTHETIC_BRIEFING_CLEAR_ON_LOCK");
  await review(page);
  const reviewed = JSON.parse(await downloadText(page, "Download reviewed research JSON"));
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  const guard = page.getByRole("dialog", { name: "Lock vault and close this draft?", exact: true });
  // Saving the ordinary working experiment cannot persist the separate plan.
  await expect(guard.getByRole("button", { name: "Save and continue", exact: true })).toHaveCount(0);
  await guard.getByRole("button", { name: "Keep current session", exact: true }).click();
  expect(JSON.parse(await downloadText(page, "Download working experiment JSON"))).toEqual(working);
  expect(JSON.parse(await downloadText(page, "Download reviewed research JSON"))).toEqual(reviewed);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await guard.getByRole("button", { name: "Discard changes and lock", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("experiment-title")).toHaveCount(0);
  await expect(page.getByLabel("Reviewed AI briefing text", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download reviewed research JSON", exact: true })).toHaveCount(0);
  const text = await page.locator("body").textContent();
  for (const marker of ["SYNTHETIC_BASELINE_ONLY", "SYNTHETIC_VARIANT_ONE", "SYNTHETIC_CONTEXT_ONLY", "SYNTHETIC_BRIEFING_CLEAR_ON_LOCK", "UNSAVED_WORKING_INPUT_TO_PROTECT"]) expect(text).not.toContain(marker);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await reopen(page, existing.title);
  expect(await backup(page)).toEqual(existing);
  await openStudio(page);
  await expect(page.getByLabel("Plan title", { exact: false })).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true })).not.toBeChecked();
});

test("the optional briefing is reviewed plain text and expires after edits or event opt-out", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const requests = watchResearchRequests(page);
  await page.goto(route);
  const existing = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  existing.attempts[0].input = "STORED_INPUT_EXCLUDED_FROM_BRIEF";
  existing.attempts[0].response = "STORED_RESPONSE_EXCLUDED_FROM_BRIEF";
  await page.getByTestId("restore-experiment").setInputFiles({ name: "existing-synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(existing)) });
  await openStudio(page);
  await fillPlan(page, 0);
  await expect(page.getByLabel("Briefing goal", { exact: false })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true }).check();
  await expect(page.getByLabel("Briefing goal", { exact: false })).toHaveValue("");
  await expect(page.getByLabel("Briefing constraints", { exact: false })).toHaveValue("");
  const goal = "Help outline a local synthetic comparison.\n<script>window.briefingExecuted=true</script>";
  const constraints = "Only invented scenarios; preserve α, \u200b and  two spaces.";
  await page.getByLabel("Briefing goal", { exact: false }).fill(goal);
  await page.getByLabel("Briefing constraints", { exact: false }).fill(constraints);
  await page.getByRole("button", { name: "Preview briefing", exact: true }).click();
  const preview = page.getByLabel("Reviewed AI briefing text", { exact: true });
  await expect(preview).toContainText(goal);
  await expect(preview).toContainText(constraints);
  const reviewedText = (await preview.textContent())!;
  expect(reviewedText).not.toContain("SYNTHETIC_BASELINE_ONLY");
  expect(reviewedText).not.toContain("SYNTHETIC_CONTEXT_ONLY");
  expect(reviewedText).not.toContain("STORED_INPUT_EXCLUDED_FROM_BRIEF");
  expect(reviewedText).not.toContain("STORED_RESPONSE_EXCLUDED_FROM_BRIEF");
  await page.getByRole("button", { name: "Copy reviewed briefing", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(reviewedText);
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", {
    configurable: true,
    value: async () => { throw new DOMException("Synthetic clipboard denial", "NotAllowedError"); },
  }));
  await page.getByRole("button", { name: "Copy reviewed briefing", exact: true }).click();
  const manualCopy = page.getByLabel("Manual copy of reviewed briefing", { exact: true });
  await expect(manualCopy).toHaveValue(reviewedText);
  await expect(manualCopy).toBeFocused();
  await expect(manualCopy).toHaveAttribute("readonly", "");
  await page.getByLabel("Briefing constraints", { exact: false }).fill("New constraint requires another review.");
  await expect(preview).toHaveCount(0);
  await expect(manualCopy).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy reviewed briefing", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Preview briefing", exact: true }).click();
  await expect(preview).toContainText("New constraint requires another review.");
  await page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true }).uncheck();
  await expect(preview).toHaveCount(0);
  await expect(page.getByLabel("Briefing goal", { exact: false })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true }).check();
  await expect(page.getByLabel("Briefing goal", { exact: false })).toHaveValue("");
  await review(page);
  await page.getByRole("button", { name: "Prepare untested attempts", exact: true }).click();
  const prepared = await backup(page);
  expect(prepared.attempts).toHaveLength(1);
  expect(prepared.attempts[0]).toMatchObject({ authorship: "unspecified", executionState: "not-tested", response: "", actions: "", assessment: "unassessed" });
  expect(await page.evaluate(() => Object.hasOwn(window, "briefingExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("a prepared plan survives explicit encrypted save, reopen, Markdown export and JSON restore", async ({ page }) => {
  await page.goto(route);
  await prepare(page);
  const prepared = await backup(page);
  await createVault(page);
  await save(page);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveCount(0);
  await page.reload();
  await reopen(page, prepared.title);
  expect(await backup(page)).toEqual(prepared);
  await page.getByRole("button", { name: "Research library", exact: true }).click();
  const library = page.getByRole("region", { name: "Research library", exact: true });
  await library.getByRole("checkbox", { name: `Select ${prepared.title}`, exact: true }).check();
  await library.getByRole("button", { name: "Preview Obsidian pack", exact: true }).click();
  await library.getByLabel("Preview file", { exact: true }).selectOption(`experiments/${prepared.id}.md`);
  const note = await library.getByLabel(`Private pack file preview: experiments/${prepared.id}.md`, { exact: true }).textContent();
  for (const input of [baseline, firstVariant, secondVariant]) expect(note).toContain(input);
  expect(note).toContain("publish: false");
  const packWaiting = page.waitForEvent("download");
  await library.getByRole("button", { name: "Download Obsidian pack", exact: true }).click();
  const pack = await packWaiting;
  expect(pack.suggestedFilename()).toBe("nestcipher-private-obsidian-pack.zip");
  const packPath = await pack.path();
  expect(packPath).not.toBeNull();
  // Existing ZIP compatibility tests validate the encoder; this checks saved
  // planned evidence reaches the downloaded pack.
  const bytes = await readFile(packPath!);
  for (const input of [baseline, firstVariant, secondVariant]) expect(bytes.includes(Buffer.from(input))).toBe(true);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const markdown = await downloadText(page, "Download private Markdown");
  for (const input of [baseline, firstVariant, secondVariant]) expect(markdown).toContain(input);
  expect(markdown).toContain("publish: false");
  expect(markdown).toContain("30 full days");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await page.getByTestId("attempt-input").fill("Unsaved later edit, excluded from downloaded prepared snapshot.");
  await page.getByTestId("restore-experiment").setInputFiles({ name: "prepared-synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(prepared)) });
  const guard = page.getByRole("dialog", { name: "Restore this private JSON backup", exact: true });
  await guard.getByRole("button", { name: "Replace current session", exact: true }).click();
  expect(await backup(page)).toEqual(prepared);
});

test("the planning and review views stay within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(route);
  await openStudio(page);
  await fillPlan(page);
  await page.getByLabel("Plan title", { exact: false }).focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" keyboard edit");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await review(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await expect(page.getByLabel("Plan title", { exact: false })).toHaveValue("Synthetic planning comparison keyboard edit");
  await page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true }).check();
  await page.getByLabel("Briefing goal", { exact: false }).fill("A synthetic goal with a long_unbroken_" + "word".repeat(100));
  await page.getByRole("button", { name: "Preview briefing", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("incomplete and oversized edits retain the draft, and an authored example requires explicit replacement", async ({ page }) => {
  await page.goto(route);
  await openStudio(page);
  await page.getByLabel("Plan title", { exact: false }).fill("Manual draft to keep");
  await page.getByRole("button", { name: "Review plan", exact: true }).click();
  const error = page.getByRole("region", { name: "Prompt Studio", exact: true }).getByRole("alert");
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  await expect(page.getByRole("button", { name: "Prepare untested attempts", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Plan title", { exact: false })).toHaveValue("Manual draft to keep");
  await page.getByLabel("Plan title", { exact: false }).fill("x".repeat(2001));
  await expect(error).toContainText("whole edit was rejected");
  await expect(error).toBeFocused();
  await expect(page.getByLabel("Plan title", { exact: false })).toHaveValue("Manual draft to keep");
  await page.getByRole("button", { name: "Load synthetic plan", exact: true }).click();
  const replacement = page.getByRole("group", { name: "Replace planner with synthetic example", exact: true });
  await replacement.getByRole("button", { name: "Keep current plan", exact: true }).click();
  await expect(page.getByLabel("Plan title", { exact: false })).toHaveValue("Manual draft to keep");
  await page.getByRole("button", { name: "Load synthetic plan", exact: true }).click();
  await replacement.getByRole("button", { name: "Replace with synthetic plan", exact: true }).click();
  await expect(page.getByText("Started from synthetic example", { exact: true })).toBeVisible();
  await review(page);
  const authored: Experiment = JSON.parse(await downloadText(page, "Download reviewed research JSON"));
  expect(authored.tags).toEqual(["synthetic-example"]);
  expect(authored.attempts).toHaveLength(2);
  expect(authored.attempts[1].parentId).toBe(authored.attempts[0].id);
  expect(authored.attempts.every((attempt) => attempt.executionState === "not-tested" && attempt.response === "" && attempt.assessment === "unassessed")).toBe(true);
  expect(authored.attempts[0].notes).toContain("Started from an independently invented synthetic plan");
  expect(authored.attempts[0].acquisition.input).toBe("imported");
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  const editedInput = "RESEARCHER_EDIT_AFTER_SYNTHETIC_PLAN\n  Preserve this new input exactly.";
  await page.getByLabel("Baseline input", { exact: false }).fill(editedInput);
  await page.getByRole("button", { name: "Add variant", exact: true }).click();
  await page.getByLabel("Variant 2 input", { exact: false }).fill("A new researcher-entered synthetic candidate.");
  await page.getByLabel("Variant 2 change", { exact: false }).fill("Introduce a new candidate while retaining the planned context.");
  await review(page);
  const edited: Experiment = JSON.parse(await downloadText(page, "Download reviewed research JSON"));
  expect(edited.tags).toEqual(["synthetic-example"]);
  expect(edited.attempts[0].input).toBe(editedInput);
  expect(edited.attempts[0].acquisition.input).toBe("browser-edited");
  expect(edited.attempts[1].acquisition.input).toBe("imported");
  expect(edited.attempts[2].acquisition.input).toBe("browser-entered");
  expect(edited.attempts[0].notes).toContain("current inputs and conditions may have been edited");
  expect(edited.attempts[0].notes).not.toContain("agenda and inputs are authored fixtures");
});

test("a late clipboard rejection cannot redisplay a briefing after vault lock", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        (window as Window & { syntheticClipboardFinished?: boolean }).syntheticClipboardFinished = true;
        throw new DOMException("Synthetic clipboard denial", "NotAllowedError");
      } },
    });
  });
  const existing = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  existing.title = "Synthetic saved clipboard lifecycle test";
  await page.goto(route);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(existing)) });
  await createVault(page);
  await save(page);
  await openStudio(page);
  await fillPlan(page, 0);
  await page.getByRole("checkbox", { name: "This event allows AI-assisted drafting", exact: true }).check();
  await page.getByLabel("Briefing goal", { exact: false }).fill("SYNTHETIC_SLOW_BRIEFING_MUST_CLEAR");
  await page.getByRole("button", { name: "Preview briefing", exact: true }).click();
  await page.getByRole("button", { name: "Copy reviewed briefing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copying…", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await page.getByRole("dialog", { name: "Lock vault and close this draft?", exact: true }).getByRole("button", { name: "Discard changes and lock", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { syntheticClipboardFinished?: boolean }).syntheticClipboardFinished)).toBe(true);
  await expect(page.getByRole("heading", { name: "Prompt Studio", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Manual copy of reviewed briefing", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Reviewed AI briefing text", { exact: true })).toHaveCount(0);
  expect(await page.locator("body").textContent()).not.toContain("SYNTHETIC_SLOW_BRIEFING_MUST_CLEAR");
});
