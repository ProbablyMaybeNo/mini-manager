import { expect, test } from "@playwright/test";

/**
 * M9.3 — Sign-up happy path (current AuthView).
 *
 * The free-tier auth UI is username + password only (no email, no
 * confirm-password, no live username-availability pill). The sign-up
 * screen leads with a "Create account" h1 (AuthView) and its submit
 * button reads "Create account" too. On success the server action mints
 * a session and redirects to /dashboard.
 */

function freshUsername(): string {
  return `qa${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

/**
 * Hydration probe (guards a classic SSR race under heavy parallel dev-server
 * load): filling + submitting the form before React attaches its onSubmit
 * listener falls through to the plain `<form>` element's default GET, which
 * reflects the fields onto the URL (`/sign-up?username=...&password=...`),
 * loses all typed state, and hangs the test waiting for a redirect that never
 * comes. "Reveal characters" (UX-015) only works once JS is live, so waiting
 * for the password field to actually flip to `type=text` proves the page is
 * interactive before we fill + submit it.
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

test.describe("M9.3 — Credentials sign-up", () => {
  test("create account → land on /dashboard", async ({ page }) => {
    // Password hashing (bcrypt, deliberately slow) plus a cold dev-server
    // compile of /dashboard under parallel worker load can push this past the
    // default 30s budget — bump it rather than weaken the assertions
    // (confirmed: 100% reliable in isolation, ~1s; only flakes under full
    // 8-worker parallel runs, matching MM-test-1 in TESTING.md).
    test.setTimeout(60_000);
    const username = freshUsername();

    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });

    // The "Create account" heading identifies the sign-up screen.
    await expect(
      page.getByRole("heading", { name: "Create account", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await waitForHydration(page);

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill("longenoughpw");

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("client-side validation blocks a too-short password", async ({
    page,
  }) => {
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Create account", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await waitForHydration(page);

    await page.getByLabel(/username/i).fill(freshUsername());
    await page.getByLabel(/password/i).fill("short"); // < 8 chars
    await page.getByRole("button", { name: /create account/i }).click();

    // Submit is a no-op while invalid — the inline field error appears and
    // we stay on the sign-up screen (no redirect to /dashboard).
    await expect(page.getByText(/min 8 characters/i)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
  });
});
