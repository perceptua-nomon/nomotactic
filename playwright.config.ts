import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the nomotactic web smoke test.
 *
 * Serves the static web export (`dist/`, produced by `npm run build:web`) and
 * drives it in a real browser. This is the render-level check that the jest
 * unit suite can't provide (jest stubs react-native), and the bundling check
 * `expo export` can't provide (it doesn't execute the app).
 *
 * Browser resolution: locally, Playwright finds the pre-installed Chromium via
 * PLAYWRIGHT_BROWSERS_PATH; in CI it is installed with `npx playwright install`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:8081",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Escape hatch: point at a pre-installed Chromium when PW_EXECUTABLE_PATH
        // is set (e.g. sandboxes that ship their own browser). Unset in CI, where
        // `npx playwright install` provides the version-matched browser.
        ...(process.env.PW_EXECUTABLE_PATH
          ? { channel: undefined, launchOptions: { executablePath: process.env.PW_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    // Serve the pre-built static export as a single-page app.
    command: "npx serve dist -s -l 8081",
    url: "http://localhost:8081",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
