import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M5 — Create + share a recipe.
 *
 * The recipe create flow is name-first: "+ Recipe" on the index opens the
 * "New recipe" slide-out → "Create & open editor" routes to the editor
 * draft (/recipes/new?name=…). The draft only persists after SAVE, then
 * appears on the index. Sharing is a one-click "Share" in the editor that
 * publishes the recipe, mints a public /r/<slug>, and copies the link to
 * the clipboard (toast: "Public link copied to clipboard").
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

    // --- Create (name-first) ---
    await page.goto("/recipes", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPE$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Fresh account → empty-state "+ Create your first recipe"; either
    // affordance opens the same name-first panel. Retry until the panel
    // mounts (guards a pre-hydration click).
    const createBtn = page
      .getByRole("button", { name: /\+ Create your first recipe|\+ Recipe/i })
      .first();
    const namePanel = page.getByRole("dialog", { name: /New recipe/i });
    await expect(async () => {
      await createBtn.click();
      await expect(namePanel).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await namePanel.locator('input[name="recipe-name"]').fill(recipeName);
    await namePanel
      .getByRole("button", { name: /Create.*open editor/i })
      .click();

    // --- Editor draft ---
    await page.waitForURL(/\/recipes\/new\?name=/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel(/recipe name/i)).toHaveValue(recipeName);

    // --- Save → back on the index, recipe now listed ---
    await page.getByRole("button", { name: /^Save$/ }).click();
    await page.waitForURL(/\/recipes$/, { timeout: 30_000 });
    // The row has both a name button and an "Edit <name>" swatch button —
    // match the name exactly.
    const recipeLink = page.getByRole("button", { name: recipeName, exact: true });
    await expect(recipeLink).toBeVisible({ timeout: 15_000 });

    // --- Open the saved recipe + publish via the editor's Share button ---
    await recipeLink.click();
    await page.waitForURL(/\/recipes\/[^/]+$/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Share$/ }).click();

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
