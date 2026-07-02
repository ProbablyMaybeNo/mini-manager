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
 * REBUILD note: the legacy /wishlist and /collections aliases now
 * permanently redirect to /collection (next.config redirects). We assert
 * both land on the canonical COLLECTION route.
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

    // The PAINTS section header carries a "+ PAINT" add button (there's also
    // a dashed "+ Add paint row" ghost-row at the bottom of the table — both
    // open the same PromptDialog via onAddPaint). .first() picks the header
    // one. Open the modal, retrying the click until the dialog mounts (guards
    // a click landing before the island has hydrated).
    const addBtn = page.getByRole("button", { name: /^\+ PAINT$/i }).first();
    const dialog = page.getByRole("dialog", { name: /^Add paint$/i });
    await expect(addBtn).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      await addBtn.click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await dialog.locator('input[name="prompt-value"]').fill(title);
    await dialog.getByRole("button", { name: /^Add$/ }).click();

    // The new paint renders as a row in the paint table. A manual entry has
    // no source URL, so its name is plain text (only scraped rows with a
    // sourceUrl render the name as a link) — match the name text exactly.
    // CollectionTable mounts BOTH the <900px card list and the ≥md table (CSS
    // toggles which is visible), so the same text exists twice in the DOM —
    // .last() is the desktop table row, the one actually visible at this
    // viewport.
    await expect(
      page.getByText(title, { exact: true }).last(),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(title, { exact: true }).last(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("M2.2 /collections (plural) and /wishlist redirect to /collection", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("legacy"));

    // Both legacy aliases permanently redirect to the canonical COLLECTION
    // route — assert the URL lands on /collection and the page renders.
    for (const legacy of ["/collections", "/wishlist"]) {
      await page.goto(legacy, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/collection(\?|$|\/)/);
      await expect(
        page.getByRole("heading", { name: /^COLLECTION$/ }),
      ).toBeVisible({ timeout: 30_000 });
    }
  });
});
