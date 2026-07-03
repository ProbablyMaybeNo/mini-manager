import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M6 — Mobile flow smokes (current mobile chrome).
 *
 * On a phone viewport (< 840px) the app drops the desktop SidebarRail for a
 * persistent bottom nav (MUX-001): four labelled tabs (Dashboard · Library ·
 * Collection · Tools) plus a "More" entry that opens the rest (Focus · Recipes
 * · Account · Tutorial) in the shared slide-out (a dialog labelled "More").
 * These tests cover the mobile nav round-trip across the current routes and a
 * core project-create flow, both rejecting horizontal scroll — the failure mode
 * this phase's audit guards against.
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

/** A primary bottom-nav tab (always visible) — click it directly. */
async function navigateViaTab(
  page: import("@playwright/test").Page,
  label: string,
  pathRe: RegExp,
): Promise<void> {
  const bar = page.getByRole("navigation", { name: /Primary/i });
  const tab = bar.getByRole("link", { name: label, exact: true });
  // Retry until the bottom-nav island has hydrated and the click registers.
  await expect(async () => {
    await tab.click();
    await page.waitForURL(pathRe, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** An overflow item — open the "More" sheet, then click its link. */
async function navigateViaMore(
  page: import("@playwright/test").Page,
  label: string,
  pathRe: RegExp,
): Promise<void> {
  const moreBtn = page.getByRole("button", { name: /^more$/i });
  const sheet = page.getByRole("dialog", { name: /^More$/i });
  await expect(async () => {
    await moreBtn.click();
    await expect(sheet).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await sheet.getByRole("link", { name: label, exact: true }).click();
  await page.waitForURL(pathRe, { timeout: 30_000 });
}

/**
 * Create a top-level project (v2 HEX.CODE flow, mobile). "+ New project"
 * creates a draft Army immediately and opens its editable INSPECTOR panel as
 * a full-screen takeover (ProjectBottomSheet, RF-10). A fresh "New Project"
 * draft opens with DETAILS already expanded (UX-005), so the Name field is
 * reachable without expanding the section first.
 */
async function addProjectMobile(
  page: import("@playwright/test").Page,
  name: string,
): Promise<void> {
  const addBtn = page.getByRole("button", { name: "New project", exact: true });
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await addBtn.click();
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const nameField = dialog.getByLabel("Name", { exact: true });
  await expect(nameField).toBeVisible({ timeout: 15_000 });
  await nameField.fill(name);
  await nameField.blur();
  await expect(
    page.getByRole("button", { name: `Manage ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Back" }).click();
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

    // Primary tabs sit in the persistent bottom bar; Recipes lives under "More".
    const tabs: Array<{ label: string; pathRe: RegExp }> = [
      { label: "LIBRARY", pathRe: /\/library/ },
      { label: "TOOLS", pathRe: /\/tools/ },
      { label: "COLLECTION", pathRe: /\/collection/ },
      { label: "DASHBOARD", pathRe: /\/dashboard/ },
    ];
    for (const dest of tabs) {
      await navigateViaTab(page, dest.label, dest.pathRe);
      await expectNoHorizontalScroll(page);
    }

    // Overflow route through the "More" sheet.
    await navigateViaMore(page, "RECIPES", /\/recipes/);
    await expectNoHorizontalScroll(page);
  });

  test("M6.2 create on mobile → inspector model count + stage bump persists", async ({
    page,
  }) => {
    // Multi-step (create → inspect → edit type → count + stage → reload); extend
    // the timeout so a loaded dev server doesn't exhaust the budget.
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("mobile-proj"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^DASHBOARD$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    // "+ New project" creates a draft Army immediately (v2 HEX.CODE — no
    // name/model-count mini-form, a deliberate redesign choice, not a
    // regression; see MISSIONS.md bug B6) and opens its editable panel.
    const name = `QA Mobile Squad ${Date.now()}`;
    await addProjectMobile(page, name);

    // A row tap opens the full editable INSPECTOR as a bottom-sheet dialog
    // (ProjectBottomSheet). The mobile card stacks title / meta / progress into
    // ONE "Manage <title>" region whose geometric center sits on the nested
    // priority dropdown — aim at the top-left title corner to hit the card body.
    await page
      .getByRole("button", { name: `Manage ${name}` })
      .click({ position: { x: 12, y: 12 } });
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // Make it a leaf (MODEL) so PROGRESS renders the model-count + stage grid.
    // DETAILS collapses on mobile once the project is named, so expand it to
    // reach the Type control (options render in a portal, so target them at the
    // page level, not inside the sheet).
    await sheet.getByRole("button", { name: /Expand DETAILS section/i }).click();
    await sheet.getByRole("combobox", { name: "Project type" }).click();
    await page.getByRole("option", { name: "MODEL" }).click();

    // Set the model count to 1, then tick the first painting stage (Built). The
    // stage steppers clamp to the model count, so Models must be raised first.
    await sheet.getByRole("button", { name: "Increase model count" }).click();
    await expect(sheet.getByText(/^0\s*\/\s*1$/).first()).toBeVisible({ timeout: 15_000 });
    await sheet.getByRole("button", { name: "Increase Built" }).click();
    await expect(sheet.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 15_000 });

    // Persistence across a reload (setCounter + updateProjectCount committed).
    // PROGRESS is open by default, so the reopened sheet shows the grid directly.
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page
        .getByRole("button", { name: `Manage ${name}` })
        .click({ position: { x: 12, y: 12 } });
      await expect(page.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 5_000 });
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
