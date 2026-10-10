import { expect, test, type Page, type Request } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createLabExperiment, getResearchLab, type ResearchLabId } from "../../src/lib/research-labs";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

const workbenchPath = "/tools/research-workbench";
const labIds: readonly ResearchLabId[] = ["source-authority", "action-evidence", "controlled-comparison"];

async function downloadText(page: Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).first().click();
  const download = await pending;
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!, "utf8");
}

function requestPage(request: Request) {
  try { return request.frame().page(); } catch { return null; }
}

test("a public lab opens a fresh private document with only its built-in identifier", async ({ page, context }) => {
  const requests: Request[] = [];
  context.on("request", (request) => requests.push(request));
  await page.goto("/labs/source-authority");
  const prepare = page.getByRole("link", { name: "Prepare in Workbench", exact: true });
  await expect(prepare).toHaveAttribute("href", `${workbenchPath}?lab=source-authority`);
  await expect(prepare).toHaveAttribute("target", "_blank");
  await expect(prepare).toHaveAttribute("rel", /noopener/);
  await expect(prepare).toHaveAttribute("rel", /noreferrer/);

  const opened = context.waitForEvent("page");
  await prepare.click();
  const workbench = await opened;
  await workbench.waitForLoadState("networkidle");
  await expect(workbench.getByRole("button", { name: "Start this lab", exact: true })).toBeEnabled();
  await expect(workbench.getByTestId("experiment-title")).toHaveCount(0);
  await expect(workbench.getByRole("button", { name: "Download full JSON backup", exact: true })).toBeDisabled();
  await expect(workbench.getByRole("button", { name: "Lock vault", exact: true })).toHaveCount(0);
  await expect(workbench.locator('script[src*="plausible.io"], script#plausible-init')).toHaveCount(0);
  const navigation = await workbench.evaluate(() => performance.getEntriesByType("navigation").map((entry) => entry.name));
  expect(navigation).toHaveLength(1);
  const url = new URL(navigation[0]);
  expect(url.pathname).toBe(workbenchPath);
  expect([...url.searchParams.entries()]).toEqual([["lab", "source-authority"]]);
  expect(requests.filter((request) => requestPage(request) === workbench && /plausible\.io|\/api\/|\/\.well-known\/vercel|\/challenge\.v2/.test(request.url()))).toEqual([]);
  await expect(page).toHaveURL(/\/labs\/source-authority$/);
});

for (const id of labIds) {
  test(`${id} prepares exact authored inputs with empty outcomes and private exports`, async ({ page }) => {
    const unexpected: string[] = [];
    page.on("request", (request) => {
      if (/plausible\.io|\/api\/|\/\.well-known\/vercel|\/challenge\.v2/.test(request.url())) unexpected.push(request.url());
    });
    await page.goto(`${workbenchPath}?lab=${id}`);
    await expect(page.getByTestId("experiment-title")).toHaveCount(0);
    const selected = getResearchLab(id)!;
    await expect(page.getByRole("region", { name: selected.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start this lab", exact: true }).click();
    const expected = createLabExperiment(id, { now: "2026-10-10T12:00:00.000Z" });
    expect(expected).not.toBeNull();
    await expect(page.getByTestId("experiment-title")).toHaveValue(expected!.title);
    await expect(page.getByTestId("storage-status")).toHaveText("Session only");
    const backup = JSON.parse(await downloadText(page, "Download full JSON backup"));
    expect(backup.schemaVersion).toBe(2);
    expect(backup.title).toBe(expected!.title);
    expect(backup.defaults).toEqual(expected!.defaults);
    expect(backup.tags).toEqual(expected!.tags);
    expect(backup.disclosure).toEqual(expected!.disclosure);
    expect(backup.disclosure).toMatchObject({ visibility: "private", publish: false, publicNotBefore: null, challenge: { endsAt: null, endConfirmed: false } });
    expect(backup.attempts).toHaveLength(2);
    expect(new Set([backup.id, ...backup.attempts.map((attempt: { id: string }) => attempt.id)]).size).toBe(3);
    for (const [index, attempt] of backup.attempts.entries()) {
      expect(attempt).toMatchObject({
        conditions: expected!.attempts[index].conditions,
        input: expected!.attempts[index].input,
        inputPlacement: expected!.attempts[index].inputPlacement,
        changeNote: expected!.attempts[index].changeNote,
        notes: expected!.attempts[index].notes,
        acquisition: expected!.attempts[index].acquisition,
        reportedTestAt: null,
        response: "", actions: "", actionsStatus: "not-recorded",
        executionState: "not-tested", executionError: "",
        assessment: "unassessed", assessmentReason: "",
      });
      expect(attempt.reportSnapshots).toBeUndefined();
      expect(attempt.parentId).toBe(index === 0 ? null : backup.attempts[0].id);
    }
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const markdown = await downloadText(page, "Download private Markdown");
    expect(markdown).toContain("publish: false");
    expect(markdown).toContain("private");
    for (const attempt of expected!.attempts) {
      expect(markdown).toContain(attempt.input);
      expect(markdown).toContain(attempt.notes);
    }
    expect(JSON.parse(await downloadText(page, "Download full JSON backup"))).toEqual(backup);
    expect(unexpected).toEqual([]);
  });
}

test("starting the selected lab protects a dirty draft and requires an explicit replacement", async ({ page }) => {
  await page.goto(`${workbenchPath}?lab=source-authority`);
  await page.getByRole("button", { name: "Load synthetic example", exact: true }).click();
  const privateInput = "Synthetic private handoff draft\n  Keep exact spacing.\u200b";
  await page.getByTestId("attempt-input").fill(privateInput);
  const before = JSON.parse(await downloadText(page, "Download full JSON backup"));
  await page.getByRole("button", { name: "Start this lab", exact: true }).click();
  const guard = page.getByRole("dialog");
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Keep current session", exact: true }).click();
  await expect(guard).not.toBeVisible();
  await expect(page.getByTestId("attempt-input")).toHaveValue(privateInput);
  expect(JSON.parse(await downloadText(page, "Download full JSON backup"))).toEqual(before);
  expect(new URL(page.url()).searchParams.get("lab")).toBe("source-authority");
  expect(page.url()).not.toContain("Synthetic%20private");

  await page.getByRole("button", { name: "Start this lab", exact: true }).click();
  await guard.getByRole("button", { name: "Replace current session", exact: true }).click();
  await expect(guard).not.toBeVisible();
  const after = JSON.parse(await downloadText(page, "Download full JSON backup"));
  expect(after.id).not.toBe(before.id);
  expect(after.attempts.every((attempt: { executionState: string }) => attempt.executionState === "not-tested")).toBe(true);
  expect(after.attempts.map((attempt: { input: string }) => attempt.input)).not.toContain(privateInput);
});

test("unknown, repeated and injected lab selectors leave the normal private workbench available", async ({ page }) => {
  for (const query of [
    "lab=unknown-lab",
    "lab=source-authority&lab=source-authority",
    "lab=source-authority&lab=action-evidence",
    `lab=${encodeURIComponent('<script>window.untrustedLabExecuted=true</script>')}`,
  ]) {
    await page.goto(`${workbenchPath}?${query}`);
    await expect(page.getByRole("button", { name: "Start an experiment", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Start this lab", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("experiment-title")).toHaveCount(0);
    await expect(page.locator('script[src*="plausible.io"], script#plausible-init')).toHaveCount(0);
    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "untrustedLabExecuted"))).toBe(false);
  }
});

test("the prepared lab itself is dirty and cannot be silently replaced", async ({ page }) => {
  await page.goto(`${workbenchPath}?lab=controlled-comparison`);
  await page.getByRole("button", { name: "Start this lab", exact: true }).click();
  const before = JSON.parse(await downloadText(page, "Download full JSON backup"));
  await page.getByRole("button", { name: "New experiment", exact: true }).click();
  const guard = page.getByRole("dialog");
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Keep current session", exact: true }).click();
  expect(JSON.parse(await downloadText(page, "Download full JSON backup"))).toEqual(before);
});
