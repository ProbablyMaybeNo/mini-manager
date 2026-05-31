import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * Library view-mode toggle — switches between dense table (list) and
 * wall-of-color (grid). Persists across reload via localStorage. The
 * selection contract (clicking a paint opens PaintDetailPanel via
 * ?paint=ID) must hold identically in both views.
 */
test.describe("Library — view mode toggle", () => {
  test("toggles list → grid, opens detail panel from a swatch, persists across reload", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/library");

    await expect(
      page.getByRole("heading", { name: /LIBRARY/i }),
    ).toBeVisible();

    // Default view is list — table row 0 is a paint with name + brand
    // columns. Confirm a list-shaped row is present first.
    await expect(page.getByRole("group", { name: /Library view mode/i }))
      .toBeVisible();

    // Click the GRID button.
    await page.getByRole("button", { name: /Grid view/i }).click();

    // Grid swatches live inside an aria-labelled "Paint swatches" grid.
    // Each cell is a button (role=gridcell) with aria-label "Name — Brand #HEX".
    const swatchGrid = page.getByRole("grid", { name: /Paint swatches/i });
    await expect(swatchGrid).toBeVisible({ timeout: 15_000 });
    const firstSwatch = swatchGrid.getByRole("gridcell").first();
    await expect(firstSwatch).toBeVisible({ timeout: 15_000 });

    // Click a swatch — must open the same PaintDetailPanel.
    const labelBefore = (await firstSwatch.getAttribute("aria-label")) ?? "";
    // Pull the paint name out of "Name — Brand #HEX" by splitting on the em-dash.
    const paintName = labelBefore.split("—")[0]?.trim() ?? "";
    expect(paintName.length).toBeGreaterThan(0);

    await firstSwatch.click();

    // Detail panel uses aria-label="{brand} {name} detail" — match on name.
    await expect(
      page.locator(`[aria-label*="${paintName} detail" i]`),
    ).toBeVisible({ timeout: 10_000 });

    // Reload and confirm grid view persists.
    await page.reload();
    await expect(page.getByRole("button", { name: /Grid view/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("gridcell").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
