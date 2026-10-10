import { defineConfig } from "@playwright/test";

// Content smoke tests run without JS (docs/THREAT-MODEL.md #6); interactive
// flows explicitly enable it in their spec. Requires: npx playwright install chromium.
// Run with `npm run test:e2e` after a
// production build; the webServer below serves the built app.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    javaScriptEnabled: false,
    baseURL: "http://localhost:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // CI/container escape hatch for a preinstalled Chromium build.
    launchOptions: process.env.PW_EXECUTABLE
      ? { executablePath: process.env.PW_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    env: {
      NESTCIPHER_APP_URL: "http://localhost:3100",
      NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW: "true",
    },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
