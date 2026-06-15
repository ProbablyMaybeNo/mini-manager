import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * Library view-mode toggle — switches between the wall-of-colour GRID
 * (SwatchWall) and the dense LIST table (PaintListTable). The selection
 * contract (clicking a paint opens the PaintInfoPanel dialog, labelled by
 * the paint name) must hold in both views.
 *
 * REBUILD note: the default view is GRID, and the toggle is a `useState`
 * SegmentedToggle (radiogroup "View mode") that does NOT persist across
 * reload — so the old localStorage-persistence assertion is dropped and
 * replaced with a both-directions toggle + detail-open check.
 *
 * We search for a stable, well-known paint first so the row set is small
 * (no scrolling needed) and the picked row's accessible name is unique
 * across both views.
 */
test.describe("Library — view mode toggle", () => {
  test("toggles grid ⇄ list and opens the detail panel from each view", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());
    await page.goto("/library", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: /^LIBRARY$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const search = page.locator('input[name="library-search"]');
    const swatchWall = page.getByRole("list", { name: /Paint swatches/i });

    // Fill the search and wait for the wall to actually filter down. The
    // input is a client island; retry the fill until the result set shrinks
    // to the handful of "Mephiston Red" rows (guards a pre-hydration fill).
    await expect(async () => {
      await search.fill("Mephiston Red");
      const count = await swatchWall.getByRole("listitem").count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(30);
    }).toPass({ timeout: 30_000 });

    const gridBtn = page.getByRole("radio", { name: /^Grid$/i });
    const listBtn = page.getByRole("radio", { name: /^List$/i });
    await expect(gridBtn).toHaveAttribute("aria-checked", "true");

    // --- Grid view: open detail from a swatch. ---
    const firstSwatch = swatchWall.getByRole("listitem").first();
    await expect(firstSwatch).toBeVisible({ timeout: 30_000 });
    const gridLabel = (await firstSwatch.getAttribute("aria-label")) ?? "";
    const gridName = gridLabel.split(",")[0]?.trim() ?? "";
    expect(gridName).toMatch(/Mephiston Red/i);
    const gridDialog = page.getByRole("dialog", { name: gridName });
    await expect(async () => {
      await firstSwatch.click();
      await expect(gridDialog.first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(gridDialog.first()).toBeHidden({ timeout: 15_000 });

    // --- Switch to LIST view. ---
    await listBtn.click();
    await expect(listBtn).toHaveAttribute("aria-checked", "true");
    await expect(gridBtn).toHaveAttribute("aria-checked", "false");

    // List rows expose a swatch button "Open <name>".
    const firstOpen = page.getByRole("button", { name: /^Open Mephiston Red/i }).first();
    await expect(firstOpen).toBeVisible({ timeout: 30_000 });
    const openLabel = (await firstOpen.getAttribute("aria-label")) ?? "";
    const listName = openLabel.replace(/^Open\s+/i, "").trim();
    const listDialog = page.getByRole("dialog", { name: listName });
    await expect(async () => {
      await firstOpen.scrollIntoViewIfNeeded();
      await firstOpen.click();
      await expect(listDialog.first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    // --- Switch back to GRID. ---
    await page.keyboard.press("Escape");
    await expect(listDialog.first()).toBeHidden({ timeout: 15_000 });
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute("aria-checked", "true");
    await expect(swatchWall).toBeVisible({ timeout: 15_000 });
  });
});
