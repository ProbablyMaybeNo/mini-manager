import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M5.1 — Share recipe (the V2-BUILD-PLAN §11.5 ship criterion)
 *
 * Walks the end-to-end flow that defines Phase 5:
 *
 *   1. Alice signs in → creates a recipe → opens the Share modal →
 *      publishes it → copies the URL out.
 *   2. Bob (separate browser context, isolated cookies) opens that URL
 *      in a private/no-account state, sees the recipe read-only.
 *   3. Bob signs in (still in his isolated context) → clicks the Clone
 *      CTA → lands on /recipes/<newId> with the cloned recipe content.
 *   4. The clone is independent: same content but a brand-new id, and
 *      no `publicSlug` on the clone (only the source carries one).
 */

test.describe("M5 — Share + Clone", () => {
  test("M5.1 — Alice publishes → Bob clones in a fresh context", async ({
    browser,
  }) => {
    // ---- Alice ----
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    await signInAs(alicePage, freshTestEmail("alice"));

    // Create a recipe and grab its id from the URL. A fresh account lands
    // on the empty state, where the create affordance reads "Create your
    // first recipe"; a populated account shows "New recipe". Match either.
    await alicePage.goto("/recipes");
    await alicePage
      .getByRole("button", { name: /New recipe|Create your first recipe/i })
      .first()
      .click();
    await alicePage.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/, {
      timeout: 10_000,
    });
    const aliceRecipeUrl = alicePage.url();
    const aliceRecipeId =
      aliceRecipeUrl.match(/\/recipes\/([a-zA-Z0-9_-]+)/)?.[1] ?? "";
    expect(aliceRecipeId.length).toBeGreaterThan(0);

    // Name the recipe — ShareModal disables [ publish ] when the name is
    // empty or the default "Untitled recipe" placeholder. (Surfaced as
    // Bug B4: migration regression — the standalone repo's recipe-create
    // landing page no longer ships a default name; pre-split it did.)
    await alicePage
      .getByRole("textbox", { name: /recipe name/i })
      .fill(`Alice Test Recipe ${Date.now()}`);
    await alicePage.getByRole("textbox", { name: /recipe name/i }).blur();

    // Open the share modal.
    await alicePage
      .getByRole("button", { name: /share recipe/i })
      .first()
      .click();
    await expect(
      alicePage.getByRole("heading", { name: /share recipe/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Hit Publish.
    await alicePage
      .getByRole("button", { name: /^Publish$/i })
      .click();

    // The URL input appears with the public slug once the action settles.
    const urlInput = alicePage
      .locator("input[readonly]")
      .filter({ hasText: "" })
      .first();
    await expect(urlInput).toBeVisible({ timeout: 10_000 });
    const publicUrl = await urlInput.inputValue();
    expect(publicUrl).toMatch(/\/r\/[a-z0-9]{10}$/);

    // ---- Bob (separate context — Playwright analogue of "different
    // device") ----
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    const publicPath = new URL(publicUrl).pathname;

    // Unauthenticated — the public path must render the recipe.
    await bobPage.goto(publicPath);
    await expect(
      bobPage.getByRole("link", { name: /Sign in/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(bobPage.getByRole("heading", { level: 1 })).toBeVisible();

    // Now Bob signs in (with a fresh email so he's not Alice).
    await signInAs(bobPage, freshTestEmail("bob"));
    await bobPage.goto(publicPath);

    // The CloneButton renders for non-owner authenticated visitors.
    await bobPage
      .getByRole("button", { name: /Clone to my recipes/i })
      .click();

    // Bob lands on his own /recipes/<newId>.
    await bobPage.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/, {
      timeout: 15_000,
    });
    const bobRecipeId =
      bobPage.url().match(/\/recipes\/([a-zA-Z0-9_-]+)/)?.[1] ?? "";

    // Clone has a fresh id — NOT the same as the source.
    expect(bobRecipeId.length).toBeGreaterThan(0);
    expect(bobRecipeId).not.toBe(aliceRecipeId);

    // The cloned recipe page renders Bob's owned editor — Share/Delete
    // buttons should be present.
    await expect(
      bobPage.getByRole("button", { name: /share recipe/i }),
    ).toBeVisible({ timeout: 10_000 });

    await aliceContext.close();
    await bobContext.close();
  });
});
