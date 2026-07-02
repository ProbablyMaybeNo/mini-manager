import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M13 — Colour-first recipe generation (deterministic engine).
 *
 * The Colour Wheel tool grew a "Generate Recipe" action: it takes the current
 * harmony palette, builds a tinted layer ramp per colour (shade→edge, cool
 * shadows / warm highlights), grounds every step to the nearest real catalog
 * paint by ΔE2000, and — on Save — persists a full recipe via the deterministic
 * `generateRecipeFromColors` action (grounded server-side; no LLM, not Pro-gated).
 *
 * The engine's maths is unit-tested (tests/unit/lib/recipes/generate.test.ts).
 * This mission drives the whole flow end-to-end: wheel → Generate Recipe →
 * preview dialog → Save → land on the new recipe with the generated notes.
 */

test.describe("M13 — Colour-first recipe generation", () => {
  test("M13.1 wheel → Generate Recipe → preview → Save → new recipe with generated notes", async ({
    page,
  }) => {
    // wheel mount + client catalog load + server grounding on save is more than
    // the default 30s allows under a cold dev server.
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("gen-recipe"));

    await page.goto("/tools/wheel", { waitUntil: "domcontentloaded" });

    // The "Generate Recipe" action lives in the wheel's HARMONY panel — its
    // presence confirms the tool mounted. Default harmony is complementary.
    const generateBtn = page.getByRole("button", { name: /^Generate Recipe$/ });
    await expect(generateBtn).toBeVisible({ timeout: 30_000 });
    await generateBtn.click();

    // The preview dialog opens with the scheme read-out (per-colour ramp swatches
    // grounded to real paints render inside).
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByText(/Generate recipe from colours/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(/scheme/i)).toBeVisible({ timeout: 15_000 });

    // Save → the server grounds against the real catalog, persists the recipe,
    // and navigates to it.
    await dialog.getByRole("button", { name: /^Save recipe$/ }).click();
    await page.waitForURL(/\/recipes\/[^/?#]+$/, { timeout: 30_000 });

    // The new recipe's editor carries the generated technique notes — proof the
    // whole pipeline (ramp → ground → compose notes → save) round-tripped.
    await expect(page.getByLabel("Recipe notes")).toHaveValue(
      /Generated from .*picked colour/i,
      { timeout: 30_000 },
    );
  });
});
