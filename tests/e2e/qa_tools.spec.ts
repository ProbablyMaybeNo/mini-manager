import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M4 — Tools smoke E2E (current tool set).
 *
 * The hub lists four colour utilities (American "Color" spelling):
 * Color Wheel, Color Match, Color Dropper, Color Stacking. This spec
 * checks the hub renders all four, then walks the wheel path: open
 * /tools/wheel, confirm the harmony picker + "Send to Recipe" action,
 * and that Send to Recipe routes to /recipes.
 *
 * REBUILD note: the old "Send to recipe" MODAL is gone — the wheel's
 * "Send to Recipe" button now navigates straight to /recipes, so we
 * assert the navigation rather than a dialog.
 */

test.describe("M4 — Tools", () => {
  test("M4.1 hub lists the four tools; wheel → Send to Recipe routes to /recipes", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/tools", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^TOOLS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Four tool cards, addressed by their hrefs (each link's name is the
    // uppercased tool title).
    await expect(page.locator('a[href="/tools/wheel"]')).toBeVisible();
    await expect(page.locator('a[href="/tools/match"]')).toBeVisible();
    await expect(page.locator('a[href="/tools/dropper"]')).toBeVisible();
    await expect(page.locator('a[href="/tools/stacking"]')).toBeVisible();

    // Open the wheel.
    await page.locator('a[href="/tools/wheel"]').click();
    await page.waitForURL(/\/tools\/wheel/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^COLOR WHEEL$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Wheel controls: the hue input + harmony picker are interactive.
    await expect(page.getByLabel(/^Hue$/i)).toBeVisible();
    await expect(page.getByText(/^Harmony$/i)).toBeVisible();

    // Send to Recipe routes to the recipes index (no modal anymore).
    await page.getByRole("button", { name: /Send to Recipe/i }).click();
    await page.waitForURL(/\/recipes/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: /^RECIPE$/ }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("M4.2 each tool route loads its own screen", async ({ page }) => {
    await signInAs(page, freshTestEmail("tools"));

    const routes: Array<{ path: string; heading: RegExp }> = [
      { path: "/tools/wheel", heading: /^COLOR WHEEL$/ },
      { path: "/tools/match", heading: /^COLOR MATCH$/ },
      { path: "/tools/dropper", heading: /^COLOR DROPPER$/ },
      { path: "/tools/stacking", heading: /^COLOR STACKING$/ },
    ];

    for (const r of routes) {
      await page.goto(r.path, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: r.heading }),
      ).toBeVisible({ timeout: 30_000 });
    }
  });
});
