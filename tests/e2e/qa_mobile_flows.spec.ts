import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M6 — Mobile flow smokes (current mobile chrome).
 *
 * On a phone viewport (< 840px) the app drops the desktop SidebarRail for a
 * hamburger in the top bar (Ross, 2026-07-27), which opens a slide-out (a
 * dialog labelled "Menu") listing EVERY page. It replaced the five-tab bottom
 * bar, which could only fit four routes and left the rest behind a "More" tab
 * while permanently occupying ~52px of screen. These tests cover the mobile nav
 * round-trip across the current routes and a core project-create flow, both
 * rejecting horizontal scroll — the failure mode this phase's audit guards
 * against.
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

/** Open the hamburger menu, then click a route in it. Every page lives here. */
async function navigateViaMenu(
  page: import("@playwright/test").Page,
  label: string,
  pathRe: RegExp,
): Promise<void> {
  const burger = page.getByRole("button", { name: /open navigation menu/i });
  const sheet = page.getByRole("dialog", { name: /^Menu$/i });
  // Retry until the top-bar island has hydrated and the click registers.
  await expect(async () => {
    await burger.click();
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
  // Phones carry exactly ONE create control at a time (MUX-003): the roster's
  // empty state owns it until there's a project, then the full-width
  // "+ NEW PROJECT" below the roster takes over. The ⊕ this used to target is
  // desktop-only now, and display:none keeps it out of the accessibility tree,
  // so exactly one of these two resolves at any moment.
  const addBtn = page.getByRole("button", {
    name: /new project|create your first project/i,
  });
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await addBtn.click();
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const nameField = dialog.getByLabel("Name", { exact: true });
  await expect(nameField).toBeVisible({ timeout: 15_000 });
  await nameField.fill(name);
  await nameField.blur();
  // R5-2 — the roster card is no longer one `role="button"` named
  // "Manage <title>"; its title is a real button named "Open <title>", the
  // same name and shape R4-8 gave the desktop row.
  await expect(
    page.getByRole("button", { name: `Open ${name}` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Back" }).click();
}

test.describe("R5-2 — the mobile roster card is a card, not a button", () => {
  test("nothing focusable nests in a role=button, and the card still opens by body tap and by keyboard", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("mobile-card"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const name = `QA Card ${Date.now()}`;
    await addProjectMobile(page, name);

    // 1. The defect. The card WAS `<div role="button" aria-label="Manage …">`
    //    with the delete bin focusable inside it (and the expand caret too,
    //    once the project has children). ARIA gives `button` presentational
    //    children, so those were invalid. This sweeps the whole page rather
    //    than the card alone — the rule has no reason to be card-specific, and
    //    it is what makes this a guard instead of a spot check.
    const nested = await page.evaluate(() => {
      const FOCUSABLE =
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return Array.from(document.querySelectorAll('[role="button"]')).flatMap(
        (host) =>
          Array.from(host.querySelectorAll(FOCUSABLE)).map(
            (el) =>
              `<${el.tagName.toLowerCase()} ${
                el.getAttribute("aria-label") ??
                el.textContent?.trim().slice(0, 30) ??
                ""
              }> inside role=button "${host.getAttribute("aria-label") ?? ""}"`,
          ),
      );
    });
    expect(nested, "focusable descendants of a role=button").toEqual([]);

    // The card itself is no longer announced as a button.
    await expect(
      page.getByRole("button", { name: `Manage ${name}` }),
    ).toHaveCount(0);

    // 2. "Cards are doors" is a locked density rule (Ross, 2026-07-27) and the
    //    whole card must stay tappable. The title button's grandparent is the
    //    card (button → title row → card); tapping the card's PROGRESS BAR —
    //    inert, nowhere near the title or the bin — must still open the
    //    project. This is the assertion that fails if the container ever loses
    //    its click handler.
    const card = page.getByRole("button", { name: `Open ${name}` }).locator("../..");
    await card.getByRole("progressbar").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^Close|^Back$/ }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

    // 3. Keyboard opening still works, natively on a real button rather than
    //    through the card's old hand-rolled keydown.
    const open = page.getByRole("button", { name: `Open ${name}` });
    await open.focus();
    await expect(open).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });

    await expectNoHorizontalScroll(page);
  });
});

test.describe("M6 — Mobile primary flows", () => {
  test("M6.1 hamburger menu opens and navigates every route", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("mobile"));

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/}),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    // No route is second-class any more — every one is reachable in one menu.
    const routes: Array<{ label: string; pathRe: RegExp }> = [
      { label: "LIBRARY", pathRe: /\/library/ },
      { label: "TOOLS", pathRe: /\/tools/ },
      { label: "COLLECTION", pathRe: /\/collection/ },
      { label: "RECIPES", pathRe: /\/recipes/ },
      { label: "FOCUS", pathRe: /\/focus/ },
      { label: "GALLERY", pathRe: /\/gallery/ },
      { label: "PROJECTS", pathRe: /\/dashboard/ },
    ];
    for (const dest of routes) {
      await navigateViaMenu(page, dest.label, dest.pathRe);
      await expectNoHorizontalScroll(page);
    }
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
      page.getByRole("heading", { name: /^PROJECTS$/}),
    ).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalScroll(page);

    // "+ New project" creates a draft Army immediately (v2 HEX.CODE — no
    // name/model-count mini-form, a deliberate redesign choice, not a
    // regression; see MISSIONS.md bug B6) and opens its editable panel.
    const name = `QA Mobile Squad ${Date.now()}`;
    await addProjectMobile(page, name);

    // A tap opens the full editable INSPECTOR as a bottom-sheet dialog
    // (ProjectBottomSheet). This used to target the whole card — one
    // "Manage <title>" role="button" with real controls nested inside it — and
    // aim at its top-left corner with `position` to avoid landing on one of
    // them. R5-2 gave the title its own button, so there is a control to hit
    // directly and the corner-aiming is gone with the construct that needed it.
    await page.getByRole("button", { name: `Open ${name}` }).click();
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
    //
    // R2-17 made the drill stack URL state (`?open=<id>`), and the panel is
    // DERIVED from it — `useInspectorStack` reads `useSearchParams`, so a
    // reload now RESTORES the sheet instead of coming back to a closed
    // dashboard. This block used to reload and re-tap the card; that tap is
    // now aimed at a card sitting behind the restored sheet and can never
    // land. The persistence being asserted is unchanged and still real — the
    // count reads 1/1 on the restored sheet — so assert it there, and pin the
    // restore itself while we are here.
    await page.reload({ waitUntil: "domcontentloaded" });
    const restored = page.getByRole("dialog");
    await expect(restored).toBeVisible({ timeout: 15_000 });
    await expect(restored.getByText(/^1\s*\/\s*1$/)).toBeVisible({ timeout: 15_000 });
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
    // Swatches are BUTTONS, not listitems: `role="listitem"` was deliberately
    // removed from them (SwatchWall F2(b)) because it overrode the native
    // button semantics screen readers need for an actionable control.
    const firstSwatch = swatchWall.getByRole("button").first();
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
