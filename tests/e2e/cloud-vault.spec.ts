import { expect, test, type Page } from "@playwright/test";
import { createSyntheticExperiment, exportExperimentJson } from "../../src/lib/research-workbench";
import type { EncryptedResearchVaultBackup } from "../../src/lib/encrypted-vault-backup";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });
const phrase = "public synthetic cloud vault phrase";
const accountId = "11111111-1111-4111-8111-111111111111";
const revisionA = "22222222-2222-4222-8222-222222222222";
const revisionB = "33333333-3333-4333-8333-333333333333";
const route = "/tools/research-workbench";

type Metadata = { revision: string; vaultId: string; updatedAt: string; sizeBytes: number; recordCount: number };
type Cloud = {
  signedIn: boolean;
  snapshot: EncryptedResearchVaultBackup | null;
  metadata: Metadata | null;
  requests: Array<{ method: string; path: string; body: unknown }>;
  failPut: "conflict" | "account-changed" | null;
  failDelete: "conflict" | null;
  delayPut?: () => Promise<void>;
  putFinished: boolean;
};

function metadata(snapshot: EncryptedResearchVaultBackup, revision = revisionA): Metadata {
  return { revision, vaultId: snapshot.header.vaultId, updatedAt: "2026-10-10T12:00:00.000Z", sizeBytes: Buffer.byteLength(JSON.stringify(snapshot)), recordCount: snapshot.records.length };
}

async function mockCloud(page: Page, snapshot: EncryptedResearchVaultBackup | null = null): Promise<Cloud> {
  const cloud: Cloud = { signedIn: true, snapshot, metadata: snapshot ? metadata(snapshot) : null, requests: [], failPut: null, failDelete: null, putFinished: false };
  await page.route("**/api/research/**", async (intercepted) => {
    const request = intercepted.request();
    const url = new URL(request.url());
    const method = request.method();
    const body: unknown = method === "GET" ? undefined : request.postDataJSON();
    cloud.requests.push({ method, path: url.pathname + url.search, body });
    let status = 200;
    let response: unknown;
    if (url.pathname === "/api/research/account") response = { configured: true, user: cloud.signedIn ? { id: accountId, email: "synthetic@example.test" } : null };
    else if (url.pathname.endsWith("/sign-in")) response = { sent: true };
    else if (url.pathname.endsWith("/sign-out")) { cloud.signedIn = false; response = { signedOut: true }; }
    else if (method === "GET") response = { backup: cloud.metadata ? { ...cloud.metadata, ...(url.searchParams.get("include") === "payload" ? { snapshot: cloud.snapshot } : {}) } : null };
    else if (method === "PUT") {
      if (cloud.delayPut) await cloud.delayPut();
      if (cloud.failPut) { status = 409; response = { code: cloud.failPut, error: "Synthetic conflict" }; }
      else {
        cloud.snapshot = (body as { snapshot: EncryptedResearchVaultBackup }).snapshot;
        cloud.metadata = metadata(cloud.snapshot, cloud.metadata ? revisionB : revisionA);
        response = { backup: cloud.metadata };
      }
      cloud.putFinished = true;
    } else if (method === "DELETE") {
      if (cloud.failDelete) { status = 409; response = { code: cloud.failDelete, error: "Synthetic conflict" }; }
      else { cloud.metadata = null; cloud.snapshot = null; response = { deleted: true, backup: null }; }
    } else { status = 404; response = { error: "Synthetic unsupported route" }; }
    await intercepted.fulfill({ status, contentType: "application/json", body: JSON.stringify(response) }).catch(() => { /* An explicitly closed panel aborts its request. */ });
  });
  return cloud;
}

async function load(page: Page, title = "Synthetic saved cloud research") {
  const experiment = createSyntheticExperiment({ now: "2026-10-01T00:00:00.000Z" });
  experiment.title = title;
  experiment.attempts[0].input = "SAVED_PRIVATE_SENTINEL\r\n\u200bExact invented evidence";
  await page.goto(route);
  await page.getByTestId("restore-experiment").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(exportExperimentJson(experiment)) });
  await expect(page.getByTestId("experiment-title")).toHaveValue(title);
  return experiment;
}

async function openLibrary(page: Page) {
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  return page.getByRole("dialog", { name: "Local vault.", exact: true });
}

async function createAndSave(page: Page) {
  const panel = await openLibrary(page);
  await panel.getByLabel("New vault passphrase", { exact: true }).fill(phrase);
  await panel.getByLabel("Confirm vault passphrase", { exact: true }).fill(phrase);
  await panel.getByRole("button", { name: "Create vault", exact: true }).click();
  await expect(panel.getByText(/Unlocked · 0 saved experiments/)).toBeVisible();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByTestId("storage-status")).toContainText("Saved locally");
}

async function backupSaved(page: Page) {
  const panel = await openLibrary(page);
  await panel.getByRole("button", { name: "Check account", exact: true }).click();
  await expect(panel.getByText("No snapshot saved", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Back up saved vault", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Saved vault snapshot backed up" })).toBeVisible();
  return panel;
}

test("local research sends no account requests; requesting a link sends only the email", async ({ page }) => {
  const cloud = await mockCloud(page);
  cloud.signedIn = false;
  await load(page);
  await createAndSave(page);
  const panel = await openLibrary(page);
  expect(cloud.requests).toEqual([]);
  await panel.getByRole("button", { name: "Check account", exact: true }).click();
  await panel.getByLabel("Account email", { exact: true }).fill("synthetic@example.test");
  await panel.getByRole("button", { name: "Email sign-in link", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Check your email" })).toBeVisible();
  expect(cloud.requests.map((request) => request.path)).toEqual(["/api/research/account", "/api/research/account/sign-in"]);
  expect(cloud.requests[1].body).toEqual({ email: "synthetic@example.test" });
  expect(JSON.stringify(cloud.requests)).not.toContain(phrase);
  expect(JSON.stringify(cloud.requests)).not.toContain("SAVED_PRIVATE_SENTINEL");
});

test("explicit backup includes encrypted saved records, excludes newer drafts, and cloud deletion keeps local work", async ({ page }) => {
  const cloud = await mockCloud(page);
  const fixture = await load(page);
  await createAndSave(page);
  await page.getByTestId("attempt-input").fill("UNSAVED_PRIVATE_SENTINEL");
  const panel = await backupSaved(page);
  const sent = cloud.requests.find((request) => request.method === "PUT")!.body as { expectedUserId: string; expectedRevision: unknown; snapshot: EncryptedResearchVaultBackup };
  expect(sent.expectedUserId).toBe(accountId);
  expect(sent.expectedRevision).toBeNull();
  expect(sent.snapshot.format).toBe("nestcipher-encrypted-research-vault");
  expect(sent.snapshot.records).toHaveLength(1);
  expect(JSON.stringify(sent)).not.toContain(phrase);
  expect(JSON.stringify(sent)).not.toContain(fixture.title);
  expect(JSON.stringify(sent)).not.toContain("SAVED_PRIVATE_SENTINEL");
  expect(JSON.stringify(sent)).not.toContain("UNSAVED_PRIVATE_SENTINEL");
  await panel.getByRole("button", { name: "Delete cloud backup", exact: true }).click();
  expect(cloud.requests.filter((request) => request.method === "DELETE")).toHaveLength(0);
  await panel.getByRole("button", { name: "Keep cloud backup", exact: true }).click();
  expect(cloud.requests.filter((request) => request.method === "DELETE")).toHaveLength(0);
  await panel.getByRole("button", { name: "Delete cloud backup", exact: true }).click();
  await panel.getByRole("button", { name: "Delete this cloud snapshot", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Cloud backup deleted" })).toBeVisible();
  expect(cloud.requests.find((request) => request.method === "DELETE")!.body).toEqual({ expectedUserId: accountId, expectedRevision: revisionA });
  await expect(panel.getByText(fixture.title, { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Signed out" })).toBeVisible();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
  await expect(page.getByTestId("attempt-input")).toHaveValue("UNSAVED_PRIVATE_SENTINEL");
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
});

test("cloud restore authenticates locally, rejects a wrong passphrase, and preserves an open draft", async ({ page, browser }) => {
  const originalCloud = await mockCloud(page);
  const fixture = await load(page);
  await createAndSave(page);
  await backupSaved(page);
  const context = await browser.newContext({ baseURL: "http://localhost:3100", javaScriptEnabled: true, reducedMotion: "reduce" });
  try {
    const second = await context.newPage();
    const cloud = await mockCloud(second, originalCloud.snapshot!);
    await load(second, "Different unsaved device draft");
    await second.getByTestId("attempt-input").fill("KEEP_DEVICE_DRAFT");
    const panel = await openLibrary(second);
    await panel.getByRole("button", { name: "Check account", exact: true }).click();
    await panel.getByLabel("Original vault passphrase", { exact: true }).fill("wrong public synthetic passphrase");
    await panel.getByRole("button", { name: "Restore encrypted backup", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("passphrase");
    await expect(panel.getByLabel("Original vault passphrase", { exact: true })).toHaveValue("");
    await expect(panel.getByText(fixture.title, { exact: true })).toHaveCount(0);
    await panel.getByLabel("Original vault passphrase", { exact: true }).fill(phrase);
    await panel.getByRole("button", { name: "Restore encrypted backup", exact: true }).click();
    await expect(panel.getByText(/Unlocked · 1 saved experiment/)).toBeVisible();
    await expect(panel.getByText(fixture.title, { exact: true })).toBeVisible();
    expect(cloud.requests.filter((request) => request.method !== "GET")).toEqual([]);
    expect(JSON.stringify(cloud.requests)).not.toContain(phrase);
    await panel.getByRole("button", { name: "Close library", exact: true }).click();
    await expect(second.getByTestId("experiment-title")).toHaveValue("Different unsaved device draft");
    await expect(second.getByTestId("attempt-input")).toHaveValue("KEEP_DEVICE_DRAFT");
    await expect(second.getByTestId("storage-status")).toHaveText("Session only");
  } finally { await context.close(); }
});

test("stale backup or deletion refuses overwrite and requires fresh cloud metadata", async ({ page }) => {
  const cloud = await mockCloud(page);
  const fixture = await load(page);
  await createAndSave(page);
  const panel = await backupSaved(page);
  cloud.failPut = "conflict";
  await panel.getByRole("button", { name: "Back up saved vault", exact: true }).click();
  expect(cloud.requests.filter((request) => request.method === "PUT")).toHaveLength(1);
  await panel.getByRole("button", { name: "Replace with saved local vault", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("changed after you checked");
  await expect(panel.getByRole("button", { name: "Back up saved vault", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Refresh cloud status", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Back up saved vault", exact: true })).toBeEnabled();
  cloud.failDelete = "conflict";
  await panel.getByRole("button", { name: "Delete cloud backup", exact: true }).click();
  await panel.getByRole("button", { name: "Delete this cloud snapshot", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("changed after you checked");
  expect(cloud.snapshot).not.toBeNull();
  await expect(panel.getByText(fixture.title, { exact: true })).toBeVisible();
});

test("a different local vault cannot replace the account snapshot or offer destructive restore", async ({ page, browser }) => {
  const originalCloud = await mockCloud(page);
  await load(page);
  await createAndSave(page);
  await backupSaved(page);
  const context = await browser.newContext({ baseURL: "http://localhost:3100", javaScriptEnabled: true, reducedMotion: "reduce" });
  try {
    const second = await context.newPage();
    const cloud = await mockCloud(second, originalCloud.snapshot!);
    const fixture = await load(second, "Different local vault");
    await createAndSave(second);
    const panel = await openLibrary(second);
    await panel.getByRole("button", { name: "Check account", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Back up saved vault", exact: true })).toBeEnabled();
    await expect(panel.getByRole("button", { name: "Restore encrypted backup", exact: true })).toHaveCount(0);
    await panel.getByRole("button", { name: "Back up saved vault", exact: true }).click();
    await panel.getByRole("button", { name: "Replace with saved local vault", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("different vault");
    expect(cloud.requests.filter((request) => request.method === "PUT")).toEqual([]);
    await expect(panel.getByText(fixture.title, { exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test("an account change refuses upload and clears stale account actions", async ({ page }) => {
  const cloud = await mockCloud(page);
  await load(page);
  await createAndSave(page);
  const panel = await openLibrary(page);
  await panel.getByRole("button", { name: "Check account", exact: true }).click();
  await expect(panel.getByText("No snapshot saved", { exact: true })).toBeVisible();
  cloud.failPut = "account-changed";
  await panel.getByRole("button", { name: "Back up saved vault", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("account changed");
  expect(cloud.snapshot).toBeNull();
  expect((cloud.requests.find((request) => request.method === "PUT")!.body as { expectedUserId: string }).expectedUserId).toBe(accountId);
  await expect(panel.getByText("Signed in · synthetic@example.test", { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Back up saved vault", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Check account", exact: true })).toBeEnabled();
});

test("locking during a pending upload closes plaintext and ignores a late cloud response", async ({ page }) => {
  const cloud = await mockCloud(page);
  const fixture = await load(page);
  await createAndSave(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  cloud.delayPut = () => waiting;
  const panel = await openLibrary(page);
  await panel.getByRole("button", { name: "Check account", exact: true }).click();
  await panel.getByRole("button", { name: "Back up saved vault", exact: true }).click();
  await expect.poll(() => cloud.requests.some((request) => request.method === "PUT")).toBe(true);
  await expect(panel.getByRole("button", { name: "Lock vault", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Lock vault", exact: true }).click();
  await expect(page.getByTestId("experiment-title")).toHaveCount(0);
  release();
  await expect.poll(() => cloud.putFinished).toBe(true);
  await expect(page.getByTestId("experiment-title")).toHaveCount(0);
  await expect(page.getByText(fixture.title, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("closing the library during a pending upload keeps the unsaved draft and does not reopen it", async ({ page }) => {
  const cloud = await mockCloud(page);
  await load(page);
  await createAndSave(page);
  await page.getByTestId("attempt-input").fill("KEEP_CLOSE_DRAFT");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  cloud.delayPut = () => waiting;
  const panel = await openLibrary(page);
  await panel.getByRole("button", { name: "Check account", exact: true }).click();
  await panel.getByRole("button", { name: "Back up saved vault", exact: true }).click();
  await expect.poll(() => cloud.requests.some((request) => request.method === "PUT")).toBe(true);
  await expect(panel.getByRole("button", { name: "Close library", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Close library", exact: true }).click();
  release();
  await expect.poll(() => cloud.putFinished).toBe(true);
  await expect(page.getByTestId("attempt-input")).toHaveValue("KEEP_CLOSE_DRAFT");
  await expect(page.getByTestId("storage-status")).toHaveText("Unsaved changes");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const cancellation of ["sign-out", "close"] as const) {
  test(`${cancellation} during restore key derivation leaves no local vault installed`, async ({ page, browser }) => {
    const originalCloud = await mockCloud(page);
    await load(page);
    await createAndSave(page);
    await backupSaved(page);
    const context = await browser.newContext({ baseURL: "http://localhost:3100", javaScriptEnabled: true, reducedMotion: "reduce" });
    try {
      const second = await context.newPage();
      await second.addInitScript(() => {
        const original = SubtleCrypto.prototype.deriveKey;
        SubtleCrypto.prototype.deriveKey = async function (...args) {
          (window as Window & { syntheticCloudKdfStarted?: boolean }).syntheticCloudKdfStarted = true;
          await new Promise((resolve) => setTimeout(resolve, 800));
          const result = await original.apply(this, args);
          (window as Window & { syntheticCloudKdfFinished?: boolean }).syntheticCloudKdfFinished = true;
          return result;
        };
      });
      await mockCloud(second, originalCloud.snapshot!);
      await load(second, "Draft retained through restore cancellation");
      const panel = await openLibrary(second);
      await panel.getByRole("button", { name: "Check account", exact: true }).click();
      await panel.getByLabel("Original vault passphrase", { exact: true }).fill(phrase);
      await panel.getByRole("button", { name: "Restore encrypted backup", exact: true }).click();
      await expect.poll(() => second.evaluate(() => (window as Window & { syntheticCloudKdfStarted?: boolean }).syntheticCloudKdfStarted)).toBe(true);
      if (cancellation === "sign-out") {
        await panel.getByRole("button", { name: "Sign out", exact: true }).click();
        await expect(panel.getByRole("status").filter({ hasText: "Signed out" })).toBeVisible();
      } else await panel.getByRole("button", { name: "Close library", exact: true }).click();
      await expect.poll(() => second.evaluate(() => (window as Window & { syntheticCloudKdfFinished?: boolean }).syntheticCloudKdfFinished)).toBe(true);
      const installed = await second.evaluate(() => new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open("nestcipher-research-vault", 1);
        request.onerror = () => reject(new Error("Synthetic inspection failed"));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("meta", "readonly");
          const header = transaction.objectStore("meta").get("header");
          header.onsuccess = () => { resolve(header.result !== undefined); database.close(); };
          header.onerror = () => { database.close(); reject(new Error("Synthetic header inspection failed")); };
        };
      }));
      expect(installed).toBe(false);
      if (cancellation === "sign-out") await panel.getByRole("button", { name: "Close library", exact: true }).click();
      await expect(second.getByTestId("experiment-title")).toHaveValue("Draft retained through restore cancellation");
      await expect(second.getByTestId("storage-status")).toHaveText("Session only");
    } finally { await context.close(); }
  });
}
