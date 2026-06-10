import { test, expect } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M2 — Collection add (FIGMA-REBUILD).
 *
 * The /wishlist and /collections surfaces redirect to /collection.
 * Covers manual entry via the header add bar → row appears in the
 * paint collection table.
 */

test.describe("M2 — Collection add", () => {
  test("M2.1 manual paint entry from the add bar → row appears", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/collection");
    await expect(
      page.getByRole("heading", { name: /^COLLECTION$/i }),
    ).toBeVisible();

    const title = `QA Test Paint ${Date.now()}`;
    const input = page.getByPlaceholder(/paste url to add paints and models/i);
    await input.fill(title);
    await page.getByRole("button", { name: /^add$/i }).click();

    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("M2.2 /wishlist permanently redirects to /collection", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/wishlist");
    await expect(page).toHaveURL(/\/collection/);
    await expect(
      page.getByRole("heading", { name: /^COLLECTION$/i }),
    ).toBeVisible();
  });

  test("M2.3 /collections permanently redirects to /collection", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/collections");
    await expect(page).toHaveURL(/\/collection/);
  });
});
