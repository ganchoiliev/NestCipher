import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: true, reducedMotion: "reduce" });
const workbench = "/tools/research-workbench";

test("a sign-in return opens the library but confirms identity only after an explicit account check", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/research/**", async (route) => {
    requested.push(new URL(route.request().url()).pathname);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, user: null }) });
  });
  await page.goto(`${workbench}?account=connected`);
  const library = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await expect(library).toBeVisible();
  await expect(library.getByRole("status").filter({ hasText: "Continue signing in" })).toBeVisible();
  await expect(library.getByText(/^Signed in ·/)).toHaveCount(0);
  expect(requested).toEqual([]);
  await library.getByRole("button", { name: "Check account", exact: true }).click();
  await expect(library.getByLabel("Account email", { exact: true })).toBeVisible();
  await expect(library.getByText(/^Signed in ·/)).toHaveCount(0);
  expect(requested).toEqual(["/api/research/account"]);
});

test("a verified account check clears the sign-in navigation hint without unlocking or uploading", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/research/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requested.push(path);
    const response = path === "/api/research/account"
      ? { configured: true, user: { id: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.test" } }
      : { backup: null };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
  });
  await page.goto(`${workbench}?account=connected`);
  const library = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await expect(library.getByText(/^Continue signing in\./)).toBeVisible();
  expect(requested).toEqual([]);
  await library.getByRole("button", { name: "Check account", exact: true }).click();
  await expect(library.getByText("Signed in · synthetic@example.test", { exact: true })).toBeVisible();
  await expect(library.getByText("No snapshot saved", { exact: true })).toBeVisible();
  await expect(library.getByText(/^Continue signing in\./)).toHaveCount(0);
  await expect(library.getByRole("button", { name: "Create vault", exact: true })).toBeVisible();
  expect(requested).toEqual(["/api/research/account", "/api/research/backup"]);
});

test("a failed account check preserves the sign-in recovery hint", async ({ page }) => {
  await page.route("**/api/research/account", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic unavailable account" }) }));
  await page.goto(`${workbench}?account=connected`);
  const library = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await library.getByRole("button", { name: "Check account", exact: true }).click();
  await expect(library.getByRole("alert")).toBeVisible();
  await expect(library.getByText(/^Continue signing in\./)).toBeVisible();
  await expect(library.getByText(/^Signed in ·/)).toHaveCount(0);
});

test("expired sign-in hints explain recovery while duplicate or unsupported query values are ignored", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => { if (/\/api\//.test(request.url())) requested.push(request.url()); });
  await page.goto(`${workbench}?account=error`);
  const library = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await expect(library.getByRole("alert")).toContainText("sign-in link could not be completed");
  await expect(library.getByRole("alert")).toContainText("latest email");
  expect(requested).toEqual([]);
  await page.goto(`${workbench}?account=connected&account=error`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`${workbench}?account=%3Cscript%3Ewindow.authHintExecuted%3Dtrue%3C%2Fscript%3E`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, "authHintExecuted"))).toBe(false);
  expect(requested).toEqual([]);
});

test("a rate-limited email request shows safe feedback and prevents immediate resend", async ({ page }) => {
  await page.clock.install();
  const sent: unknown[] = [];
  await page.route("**/api/research/account", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, user: null }) }));
  await page.route("**/api/research/account/sign-in", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "sign-in-rate-limited", error: "PRIVATE_PROVIDER_DIAGNOSTIC", retryAfterSeconds: 60 }) });
  });
  await page.goto(workbench);
  await page.getByRole("button", { name: "Local library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Local vault.", exact: true });
  await library.getByRole("button", { name: "Check account", exact: true }).click();
  await library.getByLabel("Account email", { exact: true }).fill("synthetic@example.test");
  await library.getByRole("button", { name: "Email sign-in link", exact: true }).click();
  await expect(library.getByRole("alert")).toContainText("Too many sign-in links");
  await expect(library).not.toContainText("PRIVATE_PROVIDER_DIAGNOSTIC");
  await expect(library.getByRole("button", { name: /^Request again in/ })).toBeDisabled();
  expect(sent).toEqual([{ email: "synthetic@example.test" }]);
  await page.clock.fastForward(61_000);
  await expect(library.getByRole("button", { name: "Email sign-in link", exact: true })).toBeEnabled();
  await library.getByRole("button", { name: "Close library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start an experiment", exact: false })).toBeVisible();
});
