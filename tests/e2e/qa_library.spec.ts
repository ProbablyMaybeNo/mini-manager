import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M1 — Library quick-lookup: "do I own Mephiston Red?"
 *
 * The library is client-loaded from the static ~7k paint catalog, so a
 * fresh (empty) user still sees the full wall of colour. The default view
 * is the GRID swatch wall; the header search filters by name/brand. The
 * search input is `SearchField name="library-search"`; clicking a swatch
 * opens the PaintInfoPanel slide-out (a dialog labelled with the paint
 * name). We verify the navigate → search → detail round-trip.
 */

test.describe("M1 — Library quick-lookup", () => {
  test("M1.1 navigate, search, open the paint detail panel", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^LIBRARY$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const search = page.locator('input[name="library-search"]');
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill("Mephiston Red");

    // Default GRID view: swatches are list items labelled "Name, Brand…".
    const swatchWall = page.getByRole("list", { name: /Paint swatches/i });
    // Swatches are BUTTONS, not listitems: `role="listitem"` was deliberately
    // removed from them (SwatchWall F2(b)) because it overrode the native
    // button semantics screen readers need for an actionable control.
    const firstSwatch = swatchWall.getByRole("button").first();
    await expect(firstSwatch).toBeVisible({ timeout: 30_000 });

    const label = (await firstSwatch.getAttribute("aria-label")) ?? "";
    const paintName = label.split(",")[0]?.trim() ?? "";
    expect(paintName.length).toBeGreaterThan(0);

    await firstSwatch.click();

    // The detail slide-out is a dialog labelled with the paint name.
    await expect(
      page.getByRole("dialog", { name: paintName }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("M1.2 the desktop header carries search + view toggle (no floating filter)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, freshTestEmail("desk"));
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^LIBRARY$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // The view-mode toggle + the single Filter trigger live in the header.
    await expect(
      page.getByRole("radiogroup", { name: /View mode/i }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Grid$/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^List$/i })).toBeVisible();

    // Exactly one Filter affordance (the header button) — no stray floating
    // duplicate at desktop width.
    await expect(
      page.getByRole("button", { name: /^Filter/i }),
    ).toHaveCount(1);
  });
});
