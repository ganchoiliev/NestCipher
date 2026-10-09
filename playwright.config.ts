import { defineConfig } from "@playwright/test";

// JS-off smoke tests (docs/THREAT-MODEL.md #6): the site must render its
// content with JavaScript disabled. Requires: npx playwright install chromium.
// Run with `npm run test:e2e` after a
// production build; the webServer below serves the built app.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    javaScriptEnabled: false,
    baseURL: "http://localhost:3100",
    // CI/container escape hatch for a preinstalled Chromium build.
    launchOptions: process.env.PW_EXECUTABLE
      ? { executablePath: process.env.PW_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
