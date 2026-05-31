import { expect, test } from "@playwright/test";

/**
 * M9.3 — Sign-up happy path
 *
 * Free-tier sign-up is username + password only. After submit the
 * server action mints a session cookie and the client redirects to
 * /projects.
 */

function freshUsername(): string {
  return `qa${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
}

test.describe("M9.3 — Credentials sign-up", () => {
  test("create account → land on /projects", async ({ page }) => {
    const username = freshUsername();

    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

    // Logo present + has the screen-reader fallback wordmark
    await expect(page.getByAltText("Mini Manager")).toBeVisible();

    await page.getByLabel(/username/i).fill(username);
    await page.getByLabel(/^password$/i).fill("longenoughpw");
    await page.getByLabel(/confirm password/i).fill("longenoughpw");

    // Wait for the live-check pill to flip to "available"
    await expect(page.getByText(/available/i)).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /create account/i }).click();

    await page.waitForURL(/\/projects/);
    await expect(page).toHaveURL(/\/projects/);
  });

  test("rejects a reserved username", async ({ page }) => {
    await page.goto("/sign-up");

    await page.getByLabel(/username/i).fill("admin");
    // Live check pill should render the validation error
    await expect(page.getByText(/reserved/i)).toBeVisible({ timeout: 5_000 });
  });
});
