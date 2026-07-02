import { expect, test } from "@playwright/test";

/**
 * M9.4 — Sign-in (credentials, current AuthView).
 *
 * Register a fresh user, clear the session, then sign back in with the
 * same username + password. The sign-in screen leads with a "Sign in" h1
 * and its submit button is labelled "Enter". A successful sign-in
 * redirects to /dashboard; a wrong password surfaces the generic "Wrong
 * username or password" server-error banner (role=alert).
 */

function freshUsername(): string {
  return `qa${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

const PASSWORD = "longenoughpw";

/**
 * Hydration probe (guards a classic SSR race under heavy parallel dev-server
 * load): filling + submitting the form before React attaches its onSubmit
 * listener falls through to the plain `<form>` element's default GET, which
 * reflects the fields onto the URL (`/sign-up?username=...` or
 * `/sign-in?username=...`), loses all typed state, and hangs the test
 * waiting for a redirect that never comes. "Reveal characters" (UX-015) only
 * works once JS is live, so waiting for the password field to actually flip
 * to `type=text` proves the page is interactive before we fill + submit it.
 */
async function waitForHydration(page: import("@playwright/test").Page): Promise<void> {
  const reveal = page.getByRole("button", { name: "Reveal characters" });
  const passwordField = page.getByLabel(/password/i);
  // The probe click itself can land pre-hydration too, so retry it exactly
  // like every other "guards a pre-hydration click" spot in this suite.
  await expect(async () => {
    await reveal.click();
    await expect(passwordField).toHaveAttribute("type", "text", { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

async function register(
  page: import("@playwright/test").Page,
  username: string,
): Promise<void> {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Create account", level: 1 }),
  ).toBeVisible({ timeout: 30_000 });
  await waitForHydration(page);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  // Password hashing (bcrypt, deliberately slow) plus a cold dev-server
  // compile of /dashboard under parallel worker load can push this past the
  // default 30s budget — bump it rather than weaken the assertion (confirmed
  // 100% reliable in isolation; only flakes under full parallel runs,
  // matching MM-test-1 in TESTING.md).
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
}

test.describe("M9.4 — Credentials sign-in", () => {
  test("sign up then sign back in lands on /dashboard", async ({ page }) => {
    test.setTimeout(60_000);
    const username = freshUsername();
    await register(page, username);

    // Drop the freshly-minted session so we exercise the real sign-in path.
    await page.context().clearCookies();

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Sign in", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await waitForHydration(page);

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /^enter$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("rejects a wrong password with a generic message", async ({ page }) => {
    test.setTimeout(60_000);
    const username = freshUsername();
    await register(page, username);
    await page.context().clearCookies();

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Sign in", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await waitForHydration(page);

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill("totally-wrong-pw");
    await page.getByRole("button", { name: /^enter$/i }).click();

    await expect(
      page.getByText(/wrong username or password/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
