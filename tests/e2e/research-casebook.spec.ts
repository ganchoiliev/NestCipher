import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  CASEBOOK_ORIGIN_NOTICE,
  exportResearchCasebookMarkdown,
  researchCasebook,
} from "../../src/lib/research-casebook";

const indexPath = "/casebook";
const workbenchPath = "/tools/research-workbench";
// Invented markers exercise the separation from private page-memory research.
const privateMarker = "SYNTHETIC_CASEBOOK_PRIVATE_DRAFT_13OCT";

async function refuseServiceRequests(context: BrowserContext) {
  const requests: string[] = [];
  await context.route("**/api/**", async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  return requests;
}

async function revealAuthoredOutcomes(page: Page) {
  const summaries = page.getByRole("main").locator("summary").filter({ hasText: /^Read the authored outcome$/ });
  expect(await summaries.count()).toBeGreaterThan(0);
  for (const summary of await summaries.all()) {
    await summary.click();
    await expect(summary.locator("..")).toHaveAttribute("open", "");
  }
}

async function downloadWorkingExperiment(page: Page) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full JSON backup", exact: true }).first().click();
  const path = await (await waiting).path();
  expect(path).not.toBeNull();
  return JSON.parse(await readFile(path!, "utf8"));
}

test.describe("public casebook without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the index exposes three independently authored cases without an account or client rendering", async ({ page, context }) => {
    const services = await refuseServiceRequests(context);
    const response = await page.goto(indexPath);
    expect(response?.status()).toBe(200);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(/A claim needs\s*a record\./);
    await expect(main).toContainText(/authored fictional/i);
    await expect(main).toContainText(/no model or tools run/i);
    await expect(main.locator("ol > li")).toHaveCount(3);
    for (const entry of researchCasebook) {
      const link = main.locator(`a[href="/casebook/${entry.id}"]`).first();
      await expect(link).toBeVisible();
      await expect(link).toContainText(entry.title);
    }
    expect(await main.getByRole("heading", { level: 1 }).evaluate((element) => {
      let opacity = 1;
      for (let current: Element | null = element; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
      return opacity;
    })).toBeGreaterThan(0.99);
    expect(services).toEqual([]);
  });

  test("every case exposes exact inputs, unknown conditions and native authored outcome disclosures", async ({ page, context }) => {
    const services = await refuseServiceRequests(context);
    for (const entry of researchCasebook) {
      const response = await page.goto(`${indexPath}/${entry.id}`);
      expect(response?.status()).toBe(200);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(entry.title);
      await expect(main).toContainText(CASEBOOK_ORIGIN_NOTICE);
      await expect(main).toContainText(entry.question);
      await expect(main).toContainText(entry.criterion);
      await expect(main).toContainText(entry.changeNote);
      for (const record of [entry.baseline, entry.variant]) {
        expect(await main.locator("pre").allTextContents()).toContain(record.input);
        expect(await main.locator("pre").allTextContents()).toContain(record.context);
      }
      await expect(main).toContainText("Real model version");
      await expect(main).toContainText("Real inference settings");
      await expect(main).toContainText("Unknown — no real run");
      await revealAuthoredOutcomes(page);
      for (const record of [entry.baseline, entry.variant]) {
        expect(await main.locator("pre").allTextContents()).toContain(record.reply);
        for (const action of record.actionRecord) await expect(main.getByText(action.text, { exact: true }).first()).toBeVisible();
        await expect(main.getByText(record.assessment, { exact: true })).toBeVisible();
        await expect(main.getByText(record.limits, { exact: true })).toBeVisible();
      }
      await expect(main.getByText(entry.supportedClaim, { exact: true })).toBeVisible();
      await expect(main.getByText(entry.unsupportedClaim, { exact: true })).toBeVisible();
      await expect(main.getByText(entry.followUp, { exact: true })).toBeVisible();
      await expect(main.getByRole("link", { name: "Practise the related lab", exact: true })).toHaveAttribute("href", `/labs/${entry.labId}`);
      await expect(main).toContainText(/30 full days/);
    }
    expect(services).toEqual([]);
  });

  test("method references remain explicit external links and never execute fixture text", async ({ page, context }) => {
    const services = await refuseServiceRequests(context);
    const externalNavigations: string[] = [];
    context.on("request", (request) => {
      if (request.isNavigationRequest() && !new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)) externalNavigations.push(request.url());
    });
    for (const entry of researchCasebook) {
      await page.goto(`${indexPath}/${entry.id}`);
      const main = page.getByRole("main");
      await revealAuthoredOutcomes(page);
      for (const source of entry.sources) {
        const link = main.locator(`a[href="${source.url}"]`);
        await expect(link).toContainText(source.title);
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
        await expect(link).toHaveAttribute("rel", /noreferrer/);
      }
      await expect(main).toContainText(/do not verify these fixtures/i);
      await expect(main.locator("pre a, pre script, pre iframe, pre form")).toHaveCount(0);
      await expect(main.locator('a[href^="javascript:"]')).toHaveCount(0);
    }
    expect(externalNavigations).toEqual([]);
    expect(services).toEqual([]);
  });

  test("unrecognised identifiers return 404 without echoing arbitrary case or note content", async ({ page, request }) => {
    const unknownIds = ["not-a-case", "LABELS-AND-AUTHORITY", "casebook-private-echo-13oct", encodeURIComponent("<script>fixtureExecuted=true</script>")];
    for (const id of unknownIds) {
      const response = await page.goto(`${indexPath}/${id}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Page not found.", exact: true })).toBeVisible();
      // Check the visible branded error text, excluding inert framework script
      // serialization of the requested path.
      const visibleText = await page.locator("body").innerText();
      expect(visibleText).not.toContain(decodeURIComponent(id));
      expect(visibleText).not.toContain("casebook-private-echo-13oct");
      expect(visibleText).not.toContain("fixtureExecuted");
      await expect(page.getByRole("link", { name: "Plan a follow-up", exact: true })).toHaveCount(0);
      const note = await request.get(`${indexPath}/${id}/note`);
      expect(note.status()).toBe(404);
      expect(await note.text()).not.toContain(decodeURIComponent(id));
      expect(note.headers()["content-disposition"]).toBeUndefined();
    }
    const missingLab = "casebook-404-unknown-lab-13oct";
    const labResponse = await page.goto(`/labs/${missingLab}`);
    expect(labResponse?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found.", exact: true })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(missingLab);
    await expect(page.getByRole("link", { name: "Prepare in Workbench", exact: true })).toHaveCount(0);
  });

  test("public case notes download only authored Markdown and ignore private-looking query values", async ({ page, request }) => {
    for (const entry of researchCasebook) {
      const notePath = `${indexPath}/${entry.id}/note`;
      await page.goto(`${indexPath}/${entry.id}`);
      const link = page.getByRole("link", { name: "Download authored case note", exact: true });
      await expect(link).toHaveAttribute("href", notePath);
      const response = await request.get(`${notePath}?input=${privateMarker}&response=${privateMarker}&recordId=${privateMarker}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(/^text\/markdown\b.*charset=utf-8/i);
      expect(response.headers()["content-disposition"]).toMatch(/^attachment;.*filename=/i);
      expect(response.headers()["content-disposition"]).toContain(`${entry.id}.md`);
      expect(response.headers()["x-content-type-options"]).toBe("nosniff");
      const body = await response.text();
      expect(body).toBe(exportResearchCasebookMarkdown(entry.id));
      expect(body).toContain(CASEBOOK_ORIGIN_NOTICE);
      expect(body).not.toContain(privateMarker);
      expect(body).not.toContain('"schemaVersion"');
      expect(body).not.toContain('"ciphertext"');
      const downloading = page.waitForEvent("download");
      await link.click();
      const download = await downloading;
      expect(download.suggestedFilename()).toContain(`${entry.id}.md`);
      const path = await download.path();
      expect(path).not.toBeNull();
      expect(await readFile(path!, "utf8")).toBe(body);
    }
    expect((await request.post(`${indexPath}/labels-and-authority/note`, { data: { input: privateMarker } })).status()).toBe(405);
  });
});

test.describe("casebook entry into private research", () => {
  test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

  test("a follow-up opens a fresh private Workbench and preserves an existing working draft", async ({ page, context }) => {
    const services = await refuseServiceRequests(context);
    await page.goto(workbenchPath);
    await page.getByRole("button", { name: "Load synthetic example", exact: true }).click();
    await page.getByTestId("attempt-input").fill(`${privateMarker}\n  Preserve exact whitespace and α.\u200b`);
    const before = await downloadWorkingExperiment(page);
    const casePage = await context.newPage();
    await casePage.goto(`${indexPath}/reply-and-effect`);
    const followUp = casePage.getByRole("link", { name: "Plan a follow-up", exact: true });
    await expect(followUp).toHaveAttribute("href", workbenchPath);
    await expect(followUp).toHaveAttribute("target", "_blank");
    await expect(followUp).toHaveAttribute("rel", /noopener/);
    await expect(followUp).toHaveAttribute("rel", /noreferrer/);
    const opening = context.waitForEvent("page");
    await followUp.click();
    const fresh = await opening;
    await fresh.waitForLoadState("networkidle");
    await expect(fresh).toHaveURL(new RegExp(`${workbenchPath}$`));
    expect(await fresh.evaluate(() => window.opener === null)).toBe(true);
    await expect(fresh.getByTestId("experiment-title")).toHaveCount(0);
    await expect(fresh.getByTestId("attempt-input")).toHaveCount(0);
    await expect(fresh.getByRole("button", { name: "Plan an experiment", exact: true })).toBeEnabled();
    await expect(fresh.getByRole("button", { name: "Download full JSON backup", exact: true })).toBeDisabled();
    await expect(fresh.locator('script[src*="plausible.io"], script#plausible-init')).toHaveCount(0);
    await expect(fresh.getByRole("main")).not.toContainText("The Juniper workshop draft is prepared.");
    await expect(fresh.getByRole("main")).not.toContainText(privateMarker);
    const response = await context.request.get(workbenchPath);
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("plausible.io");
    await expect(page.getByTestId("attempt-input")).toHaveValue(before.attempts[0].input);
    expect(await downloadWorkingExperiment(page)).toEqual(before);
    await expect(casePage).toHaveURL(new RegExp(`${indexPath}/reply-and-effect$`));
    expect(services).toEqual([]);
  });

  test("narrow screens in both themes keep cases, outcomes, links and keyboard focus within the page", async ({ page, context }) => {
    test.setTimeout(90_000);
    const services = await refuseServiceRequests(context);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["dark", "light"]) {
        await page.goto(indexPath);
        const currentTheme = await page.locator("html").getAttribute("class");
        if (!currentTheme?.split(/\s+/).includes(theme)) await page.getByRole("button", { name: `Switch to ${theme} theme`, exact: true }).click();
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
        for (const path of [indexPath, ...researchCasebook.map((entry) => `${indexPath}/${entry.id}`)]) {
          await page.goto(path);
          if (path !== indexPath) await revealAuthoredOutcomes(page);
          const main = page.getByRole("main");
          await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
          const overflowing = await main.evaluate((element) => [...element.querySelectorAll("h1, h2, p, pre, summary, a, button")].filter((node) => {
            const box = node.getBoundingClientRect();
            return box.width > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
          }).map((node) => `${node.tagName}: ${node.textContent?.slice(0, 60)}`));
          expect(overflowing, `${width}px ${theme} ${path}`).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          if (path !== indexPath) {
            const summary = main.locator("summary").filter({ hasText: /^Read the authored outcome$/ }).first();
            await summary.focus();
            await expect(summary).toBeFocused();
            await page.keyboard.press("Space");
            await expect(summary.locator("..")).not.toHaveAttribute("open", "");
            await page.keyboard.press("Space");
            await expect(summary.locator("..")).toHaveAttribute("open", "");
            await expect(main.locator("pre a, pre script, pre iframe")).toHaveCount(0);
          }
        }
      }
    }
    expect(errors).toEqual([]);
    expect(services).toEqual([]);
  });

  test("the casebook is discoverable from the home, community, labs and footer on mobile", async ({ page, context }) => {
    const services = await refuseServiceRequests(context);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/community", "/labs"]) {
      await page.goto(path);
      const contentLinks = page.getByRole("main").locator('a[href="/casebook"], a[href^="/casebook/"]');
      expect(await contentLinks.count(), path).toBeGreaterThan(0);
      await expect(contentLinks.first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Footer navigation", exact: true }).locator('a[href="/casebook"]')).toBeVisible();
    }
    await page.getByRole("navigation", { name: "Footer navigation", exact: true }).locator('a[href="/casebook"]').click();
    await expect(page).toHaveURL(new RegExp(`${indexPath}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/A claim needs\s*a record\./);
    expect(services).toEqual([]);
  });
});
