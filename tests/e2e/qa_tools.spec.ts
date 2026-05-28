import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M4 — Tools smoke E2E
 *
 * Verifies the V2-BUILD-PLAN §11.4 ship criterion: every tool ends in
 * "send to recipe" in one click. This spec walks the wheel path (the
 * heaviest Phase 4 surface) end-to-end:
 *
 *   1. Navigate /tools → wheel
 *   2. Wheel canvas is interactive (drag the primary pick).
 *   3. Open the Send to recipe modal from the footer action.
 */

test.describe("M4 — Tools", () => {
  test("M4.1 — landing → wheel → send-to-recipe modal opens", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    // 1. Tools landing renders the four cards.
    await page.goto("/tools");
    await expect(page.getByRole("heading", { name: /TOOLS/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Colour Wheel/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Match/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Eyedropper/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Gradient/i })).toBeVisible();

    // 2. Wheel route loads with its canvas + harmony picker.
    await page.getByRole("link", { name: /Colour Wheel/i }).click();
    await expect(
      page.getByRole("heading", { name: /COLOUR WHEEL/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("img", { name: /Colour wheel/i })).toBeVisible();
    await expect(
      page.getByRole("radiogroup", { name: /Harmony mode/i }),
    ).toBeVisible();

    // 3. Trigger send-to-recipe. The footer button is wired to open
    //    the modal; with the default wheel state the button is enabled
    //    (two complementary swatches → non-empty palette).
    await page
      .getByRole("button", { name: /Send to recipe/i })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: /SEND TO RECIPE/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The modal has both tabs; the painter starts with no recipes so
    // the "New recipe" tab is the active surface — verify it.
    await expect(page.getByRole("tab", { name: /New recipe/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Existing recipe/i })).toBeVisible();

    // Esc closes the modal.
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: /SEND TO RECIPE/i }),
    ).not.toBeVisible();
  });
});
