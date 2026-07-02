import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M5 — Create + share a recipe.
 *
 * The recipe create flow is editor-first: "+ NEW" on the /recipes index
 * routes straight to the dedicated create page (/recipes/new,
 * RecipeEditorClient) — no naming slide-out. The draft is named in the
 * editor and only persists after "Save Recipe", which returns to /recipes —
 * now the 3-pane RecipeWorkbench (Figma 28:4): a 320px recipe LIST column
 * next to an inline DETAIL column. Clicking the saved recipe's row selects
 * it into the detail column WITHOUT navigating away from /recipes; that
 * column's own "⬡ SHARE LINK" publishes the recipe, mints a public /r/<slug>,
 * and copies the link to the clipboard (toast: "Public link copied to
 * clipboard").
 *
 * REBUILD note: the previous publish/Share-modal + public-page Clone flow
 * no longer exists — the public /r/<slug> page is a read-only view with
 * no Clone CTA and no sign-in gate. We assert the create+save+publish path
 * and that the published link renders the recipe read-only in a fresh,
 * unauthenticated context.
 */

test.describe("M5 — Recipe create + share", () => {
  test("M5.1 create → save → publish → public link renders read-only", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await ctx.newPage();
    await signInAs(page, freshTestEmail("alice"));

    const recipeName = `QA Recipe ${Date.now()}`;

    // --- Create (editor-first) ---
    await page.goto("/recipes", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPES/ }),
    ).toBeVisible({ timeout: 30_000 });

    // "+ NEW" (unconditional — no separate empty-state affordance anymore)
    // routes straight to the dedicated create page. Retry until the
    // navigation lands (guards a pre-hydration click).
    const createBtn = page.getByRole("button", { name: /^\+ NEW$/i });
    await expect(async () => {
      await createBtn.click();
      await page.waitForURL(/\/recipes\/new(\?|$)/, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    // --- Editor draft: name it in the editor ---
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });
    const nameField = page.getByLabel(/recipe name/i);
    await nameField.fill(recipeName);
    await expect(nameField).toHaveValue(recipeName);

    // --- Save → back on the index (RecipeWorkbench), recipe now listed ---
    await page.getByRole("button", { name: /^Save Recipe$/i }).click();
    await page.waitForURL(/\/recipes$/, { timeout: 30_000 });
    // The list row's accessible name carries the name PLUS the "Used in…"
    // meta line (both live inside the same <button>) — match by prefix.
    const escapedName = recipeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const recipeRow = page.getByRole("button", {
      name: new RegExp(`^${escapedName}`),
    });
    await expect(recipeRow).toBeVisible({ timeout: 15_000 });

    // --- Select it (populates the DETAIL column in place, no navigation) and
    // publish via that column's own "⬡ SHARE LINK" affordance ---
    await recipeRow.click();
    await page.getByRole("button", { name: /share link/i }).click();

    // The publish toast confirms the link was copied.
    await expect(
      page.getByText(/Public link copied to clipboard/i),
    ).toBeVisible({ timeout: 30_000 });

    const publicUrl = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(publicUrl).toMatch(/\/r\/[a-z0-9]+$/i);
    const publicPath = new URL(publicUrl).pathname;

    // --- Fresh, unauthenticated context reads the public recipe page ---
    const bobCtx = await browser.newContext();
    const bobPage = await bobCtx.newPage();
    await bobPage.goto(publicPath, { waitUntil: "domcontentloaded" });

    // Read-only public view: recipe name as the page h1, "Made with Mini
    // Manager" footer. No auth required (the /r/* path is matcher-excluded).
    await expect(
      bobPage.getByRole("heading", { level: 1, name: recipeName }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(bobPage.getByText(/Made with/i)).toBeVisible();

    await ctx.close();
    await bobCtx.close();
  });
});
