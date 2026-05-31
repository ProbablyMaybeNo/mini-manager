import { expect, test } from "@playwright/test";

/**
 * M9.4 — Sign-in (credentials)
 *
 * Sign up a fresh user via the public form, then sign back in with
 * those credentials. The sign-in form lives at /sign-in; submit lands
 * on /projects.
 */

function freshUsername(): string {
  return `qa${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

test.describe("M9.4 — Credentials sign-in", () => {
  test("sign up then sign back in lands on /projects", async ({ page }) => {
    const username = freshUsername();
    const password = "longenoughpw";

    // 1. Sign up
    await page.goto("/sign-up");
    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);
    await expect(page.getByText(/available/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/projects/);

    // 2. Sign out (clear cookies)
    await page.context().clearCookies();

    // 3. Sign in
    await page.goto("/sign-in");
    await expect(page.getByRole("region", { name: "Sign in" })).toBeVisible();
    await expect(page.getByAltText("Mini Manager")).toBeVisible();

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await page.waitForURL(/\/projects/);
    await expect(page).toHaveURL(/\/projects/);
  });

  test("rejects wrong password with a generic message", async ({ page }) => {
    const username = freshUsername();
    const password = "longenoughpw";

    await page.goto("/sign-up");
    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByLabel(/confirm password/i).fill(password);
    await expect(page.getByText(/available/i)).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/projects/);
    await page.context().clearCookies();

    await page.goto("/sign-in");
    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/^password$/i).fill("totally-wrong-pw");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByText(/wrong username or password/i)).toBeVisible();
  });
});
