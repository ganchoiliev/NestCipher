import { expect, test, type Page } from "@playwright/test";
import { getResearchLab, researchLabs, type ResearchLabId } from "../../src/lib/research-labs";

function exercise(page: Page, id: ResearchLabId) {
  return page.getByRole("region", { name: `${getResearchLab(id)!.title} exercise`, exact: true });
}

test.describe("authored lab interactions", () => {
  test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });

  test("source decisions, retries and structured permissions use the actual trusted instruction", async ({ page }) => {
    const serviceRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/|\/arena\//.test(request.url())) serviceRequests.push(request.url());
    });
    await page.goto("/labs/source-authority");
    const lab = getResearchLab("source-authority")!;
    const region = exercise(page, lab.id);
    await region.getByRole("radio", { name: "The note authorises the send", exact: true }).check();
    await region.getByRole("button", { name: "Review decision", exact: true }).click();
    await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText("Review the evidence again.");
    await region.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(region.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(region.getByRole("heading", { name: /What does the/ })).toBeFocused();
    for (const labCase of lab.cases) {
      await region.getByRole("button", { name: new RegExp(labCase.title) }).click();
      const choice = labCase.choices.find((item) => item.id === labCase.correctChoiceId)!;
      await region.getByRole("radio", { name: choice.label, exact: true }).check();
      await region.getByRole("button", { name: "Review decision", exact: true }).click();
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText("That matches the record.");
      await region.getByRole("button", { name: "Check authored permission", exact: true }).click();
      await expect(region.getByRole("status").filter({ hasText: labCase.id === "trusted-user-allowed" ? /^Permitted by the trusted instruction/ : /^Not permitted by the trusted instruction/ })).toBeVisible();
    }
    await expect(region).toContainText("3 of 3 cases reviewed");
    await region.getByRole("button", { name: "Review decision", exact: true }).click();
    await expect(region).toContainText("3 of 3 cases reviewed");
    expect(serviceRequests).toEqual([]);
  });

  test("identical replies stay inconclusive until an authored action record is revealed", async ({ page }) => {
    await page.goto("/labs/action-evidence");
    const lab = getResearchLab("action-evidence")!;
    const region = exercise(page, lab.id);
    for (const labCase of lab.cases) {
      await region.getByRole("button", { name: new RegExp(labCase.title) }).click();
      await expect(region).toContainText("Read the reply, then inspect the authored action record.");
      await expect(region.locator("pre")).toHaveCount(2);
      await region.getByRole("radio", { name: "Criterion met", exact: true }).check();
      await region.getByRole("button", { name: "Review decision", exact: true }).click();
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText("Review the evidence again.");
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText("Inconclusive");
      await region.getByRole("radio", { name: "Inconclusive", exact: true }).check();
      await region.getByRole("button", { name: "Review decision", exact: true }).click();
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText("That matches the record.");
      await region.getByRole("button", { name: "Reveal action record", exact: true }).click();
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toHaveCount(0);
      await expect(region).toContainText("Record revealed");
      await expect(region.locator("pre")).toHaveCount(2 + labCase.trace!.length);
      const finalChoice = labCase.choices.find((item) => item.id === labCase.correctChoiceId)!;
      await region.getByRole("radio", { name: finalChoice.label, exact: true }).check();
      await region.getByRole("button", { name: "Review decision", exact: true }).click();
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText(labCase.conclusion);
    }
    await page.reload();
    await expect(region).toContainText("0 of 3 cases reviewed");
    await expect(region.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(region.getByRole("button", { name: "Reveal action record", exact: true })).toBeVisible();
  });

  test("comparison separates an intended change from confounders and missing conditions", async ({ page }) => {
    await page.goto("/labs/controlled-comparison");
    const lab = getResearchLab("controlled-comparison")!;
    const region = exercise(page, lab.id);
    await expect(region.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Input", exact: true }) })).toContainText("Different");
    await expect(region.getByRole("row", { name: /^Version / })).toContainText("Matched");
    for (const labCase of lab.cases) {
      await region.getByRole("button", { name: new RegExp(labCase.title) }).click();
      await region.getByRole("radio", { name: labCase.choices.find((item) => item.id === labCase.correctChoiceId)!.label, exact: true }).check();
      await region.getByRole("button", { name: "Review decision", exact: true }).click();
      await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText(labCase.conclusion);
      if (labCase.id === "multiple-changes") {
        await expect(region.getByRole("row", { name: /^Version / })).toContainText("Different");
      }
      if (labCase.id === "unknown-conditions") {
        await expect(region.getByRole("row", { name: /^Version / })).toHaveText(/Version\s*Unknown\s*Unknown\s*Unknown/);
        await expect(region).toContainText("3 matched · 1 different · 2 unknown");
      }
    }
  });

  test("client navigation to another lab starts a separate page session", async ({ page }) => {
    await page.goto("/labs/source-authority");
    const region = exercise(page, "source-authority");
    await region.getByRole("radio", { name: "The note is data; the send is unauthorised", exact: true }).check();
    await region.getByRole("button", { name: "Review decision", exact: true }).click();
    await expect(region).toContainText("1 of 3 cases reviewed");
    await page.getByRole("navigation", { name: "Breadcrumb", exact: true }).getByRole("link", { name: "Learning labs", exact: true }).click();
    await page.getByRole("link", { name: `Open ${getResearchLab("action-evidence")!.title} lab`, exact: true }).click();
    const next = exercise(page, "action-evidence");
    await expect(next).toContainText("0 of 3 cases reviewed");
    await expect(next.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(next.getByRole("button", { name: "Reveal action record", exact: true })).toBeVisible();
  });

  test("keyboard decision handling and a narrow comparison retain visible focus and contained scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/labs/controlled-comparison");
    const region = exercise(page, "controlled-comparison");
    await region.getByRole("button", { name: "Review decision", exact: true }).click();
    await expect(region.getByRole("status").filter({ hasText: "Choose a decision before reviewing it." })).toBeVisible();
    await expect(region.getByRole("heading", { name: /What does the/ })).toBeFocused();
    const correct = region.getByRole("radio", { name: "Useful controlled follow-up; repeatability remains unknown", exact: true });
    await correct.focus();
    await page.keyboard.press("Space");
    await expect(correct).toBeChecked();
    await region.getByRole("button", { name: "Review decision", exact: true }).click();
    await expect(region.getByRole("status", { name: "Decision review", exact: true })).toContainText("That matches the record.");
    const table = region.getByRole("region", { name: "Baseline and variant conditions", exact: true });
    await table.focus();
    await expect(table).toBeFocused();
    expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("unknown lab routes do not render arbitrary fixture content", async ({ page }) => {
    const response = await page.goto("/labs/not-a-lab");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Prepare in Workbench", exact: true })).toHaveCount(0);
  });
});

test.describe("learning without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the learning index and field-guide contribution template are readable", async ({ page }) => {
    await page.goto("/labs");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Learn to\s*read the evidence/i);
    for (const lab of researchLabs) {
      await expect(page.getByRole("link", { name: `Open ${lab.title} lab`, exact: true })).toBeVisible();
    }
    await page.goto("/community");
    await expect(page.getByRole("heading", { name: /Teach a lesson/ })).toBeVisible();
    const template = page.getByRole("link", { name: "Download the lab proposal template", exact: true });
    await expect(template).toHaveAttribute("download", "");
    const pending = page.waitForEvent("download");
    await template.click();
    expect((await pending).suggestedFilename()).toBe("nestcipher-lab-contribution.md");
  });

  for (const lab of researchLabs) {
    test(`${lab.id} exposes all authored cases and native explanations`, async ({ page }) => {
      await page.goto(`/labs/${lab.id}`);
      await expect(page.getByText("The interactive review needs JavaScript.", { exact: false })).toBeVisible();
      await expect(exercise(page, lab.id).getByRole("button", { name: "Review decision", exact: true })).toBeDisabled();
      const workbook = page.locator("#exercise-workbook");
      await workbook.locator("summary").first().click();
      const cases = workbook.locator("article");
      await expect(cases).toHaveCount(3);
      for (const [index, labCase] of lab.cases.entries()) {
        const article = cases.nth(index);
        await expect(article.getByRole("heading", { level: 3 })).toContainText(labCase.title);
        if (labCase.trace) {
          await article.getByText("Read the authored action record", { exact: true }).click();
          for (const entry of labCase.trace) await expect(article.getByText(entry.text, { exact: true })).toBeVisible();
        }
        await article.getByText("Read the explanation for this complete record", { exact: true }).click();
        await expect(article.getByText(labCase.explanation, { exact: true })).toBeVisible();
        await expect(article.getByText(labCase.conclusion, { exact: true })).toBeVisible();
      }
    });
  }
});
