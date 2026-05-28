import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Mini Manager E2E.
 *
 * Tests live in tests/e2e/ and follow the Mission naming convention from
 * TESTING.md — qa_*.spec.ts. The webServer block boots `npm run dev` so
 * the suite is self-contained; in CI we'd switch to `npm start` after a
 * build, but `dev` is closer to how Ross actually uses the app.
 *
 * Auth bypass: tests use `tests/e2e/_helpers/auth.ts` which calls the
 * test-only sign-in route (guarded by NODE_ENV=test) to mint a session
 * without going through the magic-link flow.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { ALLOW_TEST_AUTH: "1" },
      },
});
