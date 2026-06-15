import { test, expect } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M2 — Collection add.
 *
 * The collection surface tracks owned/wanted paints + models. A fresh
 * user starts empty, so the paint table renders an empty state with a
 * "+ Add paint" action that opens the "Add paint" modal. Adding a name
 * persists via createWishlistItem; the new row appears as a link in the
 * paint table and survives a reload.
 *
 * REBUILD note: the old /wishlist and /collections aliases are gone.
 * Neither is redirected in the current app (next.config only redirects
 * /planner), so both 404 when signed in. We assert that real behaviour
 * rather than the stale redirect contract.
 */

test.describe("M2 — Collection add", () => {
  test("M2.1 manual paint entry via the Add paint modal → row appears + persists", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/collection", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^COLLECTION$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const title = `QA Test Paint ${Date.now()}`;

    // Fresh user → the paint table shows its empty-state "+ Add paint".
    // Open the modal, retrying the click until the dialog mounts (guards
    // against a click landing before the client island has hydrated).
    const addBtn = page.getByRole("button", { name: /^\+ Add paint$/i });
    const dialog = page.getByRole("dialog", { name: /^Add paint$/i });
    await expect(addBtn).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      await addBtn.click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await dialog.locator('input[name="prompt-value"]').fill(title);
    await dialog.getByRole("button", { name: /^Add$/ }).click();

    // The new paint renders as a name link in the paint table (the row
    // also has an "Open source" ↗ link, so match the name exactly).
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("M2.2 /collections (plural) and /wishlist are no longer live routes", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("legacy"));

    // Neither alias redirects to /collection anymore — both 404 (the app
    // serves its themed not-found page). Assert the URL does NOT bounce to
    // /collection and the canonical route still works.
    for (const legacy of ["/collections", "/wishlist"]) {
      await page.goto(legacy, { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/collection(\?|$|\/)/);
      await expect(page.getByText(/PAGE NOT FOUND/i)).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.goto("/collection", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^COLLECTION$/ }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
