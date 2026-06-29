import { expect, test } from "@playwright/test";

/**
 * Web smoke test — confirms the app actually renders and routes in a browser.
 *
 * Loads the static web export served by Playwright's webServer. Asserts the
 * unauthenticated landing page renders and that navigation works. This catches
 * runtime/render regressions (broken imports, bad routes, provider crashes)
 * that tsc, eslint, and the jest unit suite do not.
 */

test("landing page renders the marketing content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Intelligent robot fleet management")).toBeVisible();
  await expect(page.getByText("Real-Time Control")).toBeVisible();
  await expect(page.getByText("Fleet Dashboard")).toBeVisible();
  await expect(page.getByText("AI-Ready")).toBeVisible();
});

test("Sign In navigates to the login route", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Sign In", { exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
