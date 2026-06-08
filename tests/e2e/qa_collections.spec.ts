import { test, expect } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M2 — Collections add (per TESTING.md mission table).
 *
 * The /wishlist surface was rebuilt + renamed to /collections. Covers the
 * manual-entry happy path: type a name into the add bar → a row appears in
 * the chosen collection table.
 *
 * URL-paste-scrape (the high-risk path) is unit-tested per-parser in
 * tests/unit/lib/scrape/parsers.test.ts against cached vendor HTML, so we
 * don't need a flaky network-dependent E2E for it.
 */

test.describe("M2 — Collections add", () => {
  test("M2.1 manual paint entry from the add bar → row appears", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/collections");
    await expect(
      page.getByRole("heading", { name: /COLLECTIONS/i }),
    ).toBeVisible();

    const title = `QA Test Paint ${Date.now()}`;
    const input = page.getByPlaceholder(/paste a vendor url/i);
    await input.fill(title);
    await input.press("Enter");

    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

    // Refresh to confirm persistence (per TESTING.md philosophy).
    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("M2.2 /wishlist permanently redirects to /collections", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/wishlist");
    await expect(page).toHaveURL(/\/collections$/);
    await expect(
      page.getByRole("heading", { name: /COLLECTIONS/i }),
    ).toBeVisible();
  });
});
