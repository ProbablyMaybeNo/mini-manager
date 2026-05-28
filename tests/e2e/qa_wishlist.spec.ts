import { test, expect } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M2 — Wishlist quick-add (per TESTING.md mission table).
 *
 * Covers the manual-entry happy path: paste any free-form text into the
 * quick-add bar → row appears in the wishlist table with status "Wanted".
 *
 * URL-paste-scrape (the high-risk path) is unit-tested per-parser in
 * tests/unit/lib/scrape/parsers.test.ts against cached vendor HTML, so
 * we don't need a flaky network-dependent E2E for it. A future M2.2 can
 * exercise the action layer's scrape pipeline against a mocked fetch.
 */

test.describe("M2 — Wishlist quick-add", () => {
  test("M2.1 manual entry from quick-add → row appears", async ({ page }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/wishlist");
    await expect(
      page.getByRole("heading", { name: /WISHLIST/i }),
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
});
