import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M1 — Library Flow 7: "do I own Mephiston Red?"
 *
 * V2-BUILD-PLAN §6.7 — three taps from cold start. Inventory state isn't
 * asserted (the test user starts empty, so the answer is always "no");
 * we verify the navigation + search + detail-panel round-trip works,
 * which is the meaningful regression surface.
 */

test.describe("M1 — Library quick-lookup", () => {
  test("M1.1 navigate, search, open detail panel", async ({ page }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/library");
    await expect(page.getByRole("heading", { name: /LIBRARY/i })).toBeVisible();

    const search = page.getByPlaceholder(/Name, brand, sku/);
    await expect(search).toBeVisible();
    await search.fill("Mephiston Red");

    // Most Citadel libraries have at least one Mephiston Red row.
    // Wait for at least one matching paint name to render.
    const firstHit = page.getByText(/Mephiston Red/i).first();
    await expect(firstHit).toBeVisible({ timeout: 15_000 });
    await firstHit.click();

    // Detail panel is rendered with aria-label="{brand} {name} detail".
    await expect(
      page.locator('[aria-label*="Mephiston Red detail" i]'),
    ).toBeVisible({ timeout: 10_000 });
  });
});
