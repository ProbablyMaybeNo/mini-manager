import { expect, test } from "@playwright/test";

/**
 * M9.3 — Sign-up happy path (current AuthView).
 *
 * The free-tier auth UI is username + password only (no email, no
 * confirm-password, no live username-availability pill). The sign-up
 * screen renders "NEW USER REGISTRATION" inside the SYS ▸ ACCESS panel
 * and its submit button reads "Create account". On success the server
 * action mints a session and redirects to /dashboard.
 */

function freshUsername(): string {
  return `qa${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

test.describe("M9.3 — Credentials sign-up", () => {
  test("create account → land on /dashboard", async ({ page }) => {
    const username = freshUsername();

    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });

    // The registration boot line identifies the sign-up screen.
    await expect(page.getByText(/NEW USER REGISTRATION/i)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill("longenoughpw");

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("client-side validation blocks a too-short password", async ({
    page,
  }) => {
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/NEW USER REGISTRATION/i)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel(/username/i).fill(freshUsername());
    await page.getByLabel(/password/i).fill("short"); // < 8 chars
    await page.getByRole("button", { name: /create account/i }).click();

    // Submit is a no-op while invalid — the inline field error appears and
    // we stay on the sign-up screen (no redirect to /dashboard).
    await expect(page.getByText(/min 8 characters/i)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
  });
});
