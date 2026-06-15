import { expect, test } from "@playwright/test";

/**
 * M9.4 — Sign-in (credentials, current AuthView).
 *
 * Register a fresh user, clear the session, then sign back in with the
 * same username + password. The sign-in screen reads "AWAITING
 * CREDENTIALS" and its submit button is labelled "Enter". A successful
 * sign-in redirects to /dashboard; a wrong password surfaces the generic
 * "Wrong username or password" server-error banner (role=alert).
 */

function freshUsername(): string {
  return `qa${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

const PASSWORD = "longenoughpw";

async function register(
  page: import("@playwright/test").Page,
  username: string,
): Promise<void> {
  await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/NEW USER REGISTRATION/i)).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("M9.4 — Credentials sign-in", () => {
  test("sign up then sign back in lands on /dashboard", async ({ page }) => {
    const username = freshUsername();
    await register(page, username);

    // Drop the freshly-minted session so we exercise the real sign-in path.
    await page.context().clearCookies();

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/AWAITING CREDENTIALS/i)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /^enter$/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("rejects a wrong password with a generic message", async ({ page }) => {
    const username = freshUsername();
    await register(page, username);
    await page.context().clearCookies();

    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/AWAITING CREDENTIALS/i)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/password/i).fill("totally-wrong-pw");
    await page.getByRole("button", { name: /^enter$/i }).click();

    await expect(
      page.getByText(/wrong username or password/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
