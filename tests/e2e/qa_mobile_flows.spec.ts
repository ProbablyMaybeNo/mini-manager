import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M6 — Mobile flow smokes (current mobile chrome).
 *
 * On a phone viewport the app drops the desktop SidebarRail for a
 * MobileTopBar: a logo + an "Open menu" button that opens the nav in the
 * shared slide-out (a dialog labelled "Navigation"). These tests cover
 * the mobile nav round-trip across the current routes and a core
 * project-create flow, both rejecting horizontal scroll — the failure
 * mode this phase's audit guards against.
 *
 * This file only runs under the chromium-mobile project (iPhone 12).
 */

async function expectNoHorizontalScroll(
  page: import("@playwright/test").Page,
): Promise<void> {
  const overflow = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
    );
  });
  expect(overflow, "page has horizontal scroll").toBeLessThanOrEqual(2);
}

async function navigateVia(
  page: import("@playwright/test").Page,
  label: string,
  pathRe: RegExp,
): Promise<void> {
  const menuBtn = page.getByRole("button", { name: /open menu/i });
  const sheet = page.getByRole("dialog", { name: /Navigation/i });
  // Retry opening the menu until the sheet mounts (guards a click that
  // lands before the MobileTopBar island has hydrated).
  await expect(async () => {
    await menuBtn.click();
    await expect(sheet).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await sheet.getByRole("link", { name: label, exact: true }).click();
  await page.waitForURL(pathRe, { timeout: 30_000 });
}

test.describe("M6 — Mobile primary flows", () => {
  test("M6.1 mobile nav sheet opens and navigates the primary routes", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("mobile"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    const destinations: Array<{ label: string; pathRe: RegExp }> = [
      { label: "LIBRARY", pathRe: /\/library/ },
      { label: "RECIPE", pathRe: /\/recipes/ },
      { label: "TOOLS", pathRe: /\/tools/ },
      { label: "COLLECTION", pathRe: /\/collection/ },
      { label: "DASHBOARD", pathRe: /\/dashboard/ },
    ];

    for (const dest of destinations) {
      await navigateVia(page, dest.label, dest.pathRe);
      await expectNoHorizontalScroll(page);
    }
  });

  test("M6.2 create a project on mobile → focus stepper bump persists", async ({
    page,
  }) => {
    // Same multi-step flow as M3.1 (create → focus → stepper → reload);
    // extend the timeout so a loaded dev server doesn't exhaust the budget.
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("mobile-proj"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    const name = `QA Mobile Squad ${Date.now()}`;
    const addBtn = page.getByRole("button", { name: /\+ New Project/i });
    const panel = page.getByRole("dialog", { name: /New Project/i });
    await expect(async () => {
      await addBtn.click();
      await expect(panel).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await panel.getByLabel(/project name/i).fill(name);
    await panel.getByLabel(/model count/i).fill("3");
    await panel.getByRole("button", { name: /create project/i }).click();
    await expect(panel).toBeHidden({ timeout: 15_000 });

    // Jump to the focus bench via the per-row focus icon.
    await page
      .getByRole("button", { name: `Open ${name} in focus` })
      .click();
    await page.waitForURL(/\/focus\?project=/, { timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    await expect(page.getByText(/^0\s*\/\s*3$/)).toBeVisible({ timeout: 15_000 });
    // Optimistic state: click bumps the UI immediately via React useState.
    // Poll reloads until the server-side state reflects 1/3 (the server action
    // has committed to the DB). This is more robust than waitForResponse under
    // parallel dev-server load (MM-test-1).
    await page
      .getByRole("button", { name: /increase models painted/i })
      .click();
    await expect(page.getByText(/^1\s*\/\s*3$/)).toBeVisible({ timeout: 15_000 });

    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/^1\s*\/\s*3$/)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 45_000 });
    await expectNoHorizontalScroll(page);
  });

  test("M6.3 library lookup renders the detail panel without clipping", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("mobile-lib"));

    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^LIBRARY$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    await page.locator('input[name="library-search"]').fill("Mephiston Red");

    const swatchWall = page.getByRole("list", { name: /Paint swatches/i });
    const firstSwatch = swatchWall.getByRole("listitem").first();
    await expect(firstSwatch).toBeVisible({ timeout: 30_000 });
    const label = (await firstSwatch.getAttribute("aria-label")) ?? "";
    const paintName = label.split(",")[0]?.trim() ?? "";
    expect(paintName.length).toBeGreaterThan(0);
    await firstSwatch.click();

    await expect(
      page.getByRole("dialog", { name: paintName }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);
  });
});
