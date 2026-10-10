import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSyntheticExperiment, exportExperimentJson } from "../../src/lib/research-workbench";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });
const route = "/tools/research-workbench";
// Public synthetic test phrase, never a user's secret.
const phrase = "synthetic local vault test phrase";

async function load(page: Page) {
  const fixture = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  fixture.title = "Synthetic encrypted research";
  fixture.attempts[0].input = "Exact synthetic evidence\r\n\u200b<script>window.vaultExecuted=true</script>";
  await page.goto(route);
  await expect(page.getByRole("button", { name: "Local library", exact: true })).toBeEnabled();
  await page.getByTestId("restore-experiment").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(fixture)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(fixture.title);
  return fixture;
}

async function createVault(page: Page) {
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await panel.getByLabel("New vault passphrase", { exact: true }).fill(phrase);
  await panel.getByLabel("Confirm vault passphrase", { exact: true }).fill(phrase);
  await panel.getByRole("button", { name: "Create vault", exact: true }).click();
  await expect(panel.getByText(/Unlocked · 0 saved experiments/)).toBeVisible();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
}

async function unlock(page: Page, passphrase = phrase) {
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await panel.getByLabel("Vault passphrase", { exact: true }).fill(passphrase);
  await panel.getByRole("button", { name: "Unlock vault", exact: true }).click();
  return panel;
}

async function backup(page: Page) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full JSON backup", exact: true }).first().click();
  const path = await (await waiting).path();
  return JSON.parse(await readFile(path!, "utf8"));
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByTestId("storage-status")).toContainText("Saved locally");
}

test("explicit encrypted saving survives reload; wrong passphrase and lock reveal no record", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (/plausible\.io|\/api\/|never-fetch/.test(request.url())) requests.push(request.url()); });
  const fixture = await load(page);
  await createVault(page);
  // Creating/unlocking the vault never saves a draft by itself.
  await expect(page.getByTestId("storage-status")).toHaveText("Session only");
  await save(page);
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveCount(0);
  await expect(page.getByText(fixture.title, { exact: true })).toHaveCount(0);
  await page.reload();
  const panel = await unlock(page, "incorrect synthetic vault phrase");
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByText(fixture.title, { exact: true })).toHaveCount(0);
  await panel.getByLabel("Vault passphrase", { exact: true }).fill(phrase);
  await panel.getByRole("button", { name: "Unlock vault", exact: true }).click();
  await panel.getByRole("button", { name: `Open saved experiment ${fixture.title}`, exact: true }).click();
  expect(await backup(page)).toEqual(fixture);
  expect(await page.evaluate(() => Object.hasOwn(window, "vaultExecuted"))).toBe(false);
  expect(requests).toEqual([]);
});

test("lock offers save/download/discard; cancelling and deleting saved copy keep the active draft", async ({ page }) => {
  const fixture = await load(page);
  await createVault(page);
  await save(page);
  await page.getByTestId("attempt-input").fill("Newer synthetic draft");
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Lock vault and close this draft?", exact: true });
  await expect(confirmation.getByRole("button", { name: "Save and continue", exact: true })).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "Download current backup", exact: true })).toBeVisible();
  await confirmation.getByRole("button", { name: "Keep current session", exact: true }).click();
  await expect(page.getByTestId("attempt-input")).toHaveValue("Newer synthetic draft");
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await panel.getByRole("button", { name: `Delete saved experiment ${fixture.title}`, exact: true }).click();
  await panel.getByRole("button", { name: "Delete saved copy", exact: true }).click();
  await expect(panel.getByText(/No saved experiments yet/)).toBeVisible();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
  await expect(page.getByTestId("attempt-input")).toHaveValue("Newer synthetic draft");
  expect((await backup(page)).attempts[0].input).toBe("Newer synthetic draft");
});

test("editing during encryption leaves the new draft unsaved and saves only the submitted revision", async ({ page }) => {
  await page.addInitScript(() => {
    const original = SubtleCrypto.prototype.encrypt;
    SubtleCrypto.prototype.encrypt = async function (...args) {
      // Creation check is tiny; delay only record encryption to expose the race.
      if ((args[2] as ArrayBuffer).byteLength > 1000) await new Promise((resolve) => setTimeout(resolve, 600));
      return original.apply(this, args);
    };
  });
  const fixture = await load(page);
  await createVault(page);
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await page.getByTestId("attempt-input").fill("Edited during save");
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  await expect(page.getByRole("main").getByRole("status")).toContainText("Newer edits remain unsaved");
  expect((await backup(page)).attempts[0].input).toBe("Edited during save");
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await page.getByRole("dialog", { name: "Lock vault and close this draft?", exact: true }).getByRole("button", { name: "Discard changes and lock", exact: true }).click();
  const panel = await unlock(page);
  await panel.getByRole("button", { name: `Open saved experiment ${fixture.title}`, exact: true }).click();
  expect(await backup(page)).toEqual(fixture);
});

test("two tabs cannot overwrite a newer revision; a conflict can be kept as a distinct copy", async ({ page, context }) => {
  const fixture = await load(page);
  await createVault(page);
  await save(page);
  const second = await context.newPage();
  await second.goto(route);
  const panel = await unlock(second);
  await panel.getByRole("button", { name: `Open saved experiment ${fixture.title}`, exact: true }).click();
  await second.getByTestId("attempt-input").fill("Second tab revision");
  await save(second);
  await page.getByTestId("attempt-input").fill("First tab private conflict");
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("attempt-input")).toHaveValue("First tab private conflict");
  await page.getByRole("button", { name: "Save as new copy", exact: true }).click();
  await expect(page.getByTestId("storage-status")).toContainText("Saved locally");
  const copy = await backup(page);
  expect(copy.id).not.toBe(fixture.id);
  expect(copy.attempts[0].id).not.toBe(fixture.attempts[0].id);
  expect(copy.attempts[1].parentId).toBe(copy.attempts[0].id);
  expect(copy.attempts[0].input).toBe("First tab private conflict");
  await second.getByRole("button", { name: "Lock vault", exact: true }).click();
  const latest = await unlock(second);
  await expect(latest.getByText(/Unlocked · 2 saved experiments/)).toBeVisible();
});

test("quota failure preserves a usable draft and never announces a successful save", async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "records") throw new DOMException("synthetic quota failure", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  const fixture = await load(page);
  await createVault(page);
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("storage is full");
  await expect(page.getByTestId("storage-status")).toHaveText("Session only");
  expect(await backup(page)).toEqual(fixture);
});

test("legacy v1 backups migrate privately and line-ending changes are visible without executing evidence", async ({ page }) => {
  const fixture = createSyntheticExperiment();
  fixture.attempts[0].input = "same\r\n\u200b<script>window.diffExecuted=true</script>";
  fixture.attempts[1].input = "same\n\u200b<script>window.diffExecuted=true</script>";
  await page.goto(route);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "legacy-v1.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...fixture, schemaVersion: 1 })) });
  const restored = await backup(page);
  expect(restored).toEqual(fixture);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.getByRole("button", { name: "Changes", exact: true }).click();
  const diff = page.getByRole("region", { name: "Prompt input text changes", exact: true });
  await expect(diff).toContainText("CRLF");
  await expect(diff).toContainText("LF");
  await expect(diff).toContainText("U+200B");
  await expect(diff).toContainText("Removed from baseline");
  await expect(diff).toContainText("Added in variant");
  expect(await page.evaluate(() => Object.hasOwn(window, "diffExecuted"))).toBe(false);
  expect(await backup(page)).toEqual(fixture);
});

async function delaySelectedBackup(page: Page, slowSave = false) {
  await page.addInitScript((delayEncryption) => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      const content = await original.call(this);
      if (this.name === "delayed-private.json") {
        await new Promise((resolve) => setTimeout(resolve, 800));
        (window as Window & { delayedBackupFinished?: boolean }).delayedBackupFinished = true;
      }
      return content;
    };
    if (delayEncryption) {
      const encrypt = SubtleCrypto.prototype.encrypt;
      SubtleCrypto.prototype.encrypt = async function (...args) {
        if ((args[2] as ArrayBuffer).byteLength > 1000) await new Promise((resolve) => setTimeout(resolve, 1300));
        return encrypt.apply(this, args);
      };
    }
  }, slowSave);
}

test("a pending private file restore cannot reopen plaintext after locking", async ({ page }) => {
  await delaySelectedBackup(page);
  const fixture = await load(page);
  await createVault(page);
  await save(page);
  fixture.title = "Delayed plaintext must stay hidden";
  await page.getByTestId("restore-experiment").setInputFiles({ name: "delayed-private.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(fixture)) });
  await page.getByRole("button", { name: "Lock vault", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { delayedBackupFinished?: boolean }).delayedBackupFinished)).toBe(true);
  await expect(page.getByTestId("experiment-title")).toHaveCount(0);
  await expect(page.getByText(fixture.title, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a slower older restore cannot replace a newer selected backup", async ({ page }) => {
  await delaySelectedBackup(page);
  const fixture = await load(page);
  fixture.title = "Older delayed selection";
  await page.getByTestId("restore-experiment").setInputFiles({ name: "delayed-private.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(fixture)) });
  const newest = { ...fixture, title: "Newest selected backup" };
  await page.getByTestId("restore-experiment").setInputFiles({ name: "newest-private.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(newest)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(newest.title);
  await expect.poll(() => page.evaluate(() => (window as Window & { delayedBackupFinished?: boolean }).delayedBackupFinished)).toBe(true);
  expect(await backup(page)).toEqual(newest);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("save and continue cannot execute a superseded discard decision", async ({ page }) => {
  await delaySelectedBackup(page, true);
  const fixture = await load(page);
  await createVault(page);
  await save(page);
  await page.getByTestId("attempt-input").fill("Synthetic draft to keep");
  const next = { ...fixture, title: "Latest restore intent" };
  await page.getByTestId("restore-experiment").setInputFiles({ name: "delayed-private.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(next)) });
  await page.getByRole("button", { name: "New experiment", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { delayedBackupFinished?: boolean }).delayedBackupFinished)).toBe(true);
  const latest = page.getByRole("dialog", { name: "Restore this private JSON backup", exact: true });
  await expect(latest.getByRole("button", { name: "Keep current session", exact: true })).toBeEnabled();
  await expect(page.getByTestId("experiment-title")).toHaveValue(fixture.title);
  await latest.getByRole("button", { name: "Keep current session", exact: true }).click();
  expect((await backup(page)).attempts[0].input).toBe("Synthetic draft to keep");
});
