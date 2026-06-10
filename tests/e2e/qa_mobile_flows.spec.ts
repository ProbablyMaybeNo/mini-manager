import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M6 — Mobile flow smokes
 *
 * Phase 6 ship criterion (per V2-BUILD-PLAN §11.6): every primary flow
 * runs on Ross's phone. These three missions cover the bottom tab bar
 * navigation, the Unit-project create + bump round-trip, and the
 * Library lookup — all at an iPhone-X-class viewport (390x844 from
 * Playwright's iPhone 12 device descriptor).
 *
 * Each test rejects the existence of horizontal scroll on the relevant
 * page — that's the failure mode this phase's audit was designed to
 * prevent.
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

test.describe("M6 — Mobile primary flows", () => {
  test("M6.1 mobile nav sheet opens and navigates primary routes", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("mobile"));

    await page.goto("/projects");
    await expectNoHorizontalScroll(page);

    const destinations: Array<{ label: string; pathRe: RegExp }> = [
      { label: "LIBRARY", pathRe: /\/library/ },
      { label: "RECIPE", pathRe: /\/recipes/ },
      { label: "TOOLS", pathRe: /\/tools/ },
      { label: "COLLECTION", pathRe: /\/collection/ },
      { label: "DASHBOARD", pathRe: /\/projects/ },
    ];

    for (const dest of destinations) {
      await page.getByRole("button", { name: /open navigation/i }).click();
      const sheet = page.getByRole("dialog", { name: /navigation/i });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("link", { name: dest.label, exact: true }).click();
      await page.waitForURL(dest.pathRe, { timeout: 10_000 });
      await expectNoHorizontalScroll(page);
    }
  });

  test("M6.2 create Unit project on mobile → bump → reload persists", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("mobile-proj"));

    await page.goto("/projects/new");
    const unique = `QA Mobile Squad ${Date.now()}`;
    await page.getByPlaceholder(/Tactical Squad Alpha/).scrollIntoViewIfNeeded();
    await page.getByPlaceholder(/Tactical Squad Alpha/).fill(unique);
    await page.locator('input[type="number"]').first().fill("3");
    await page
      .getByRole("button", { name: /create project/i })
      .click();

    await expect(page).toHaveURL(/\/projects\?project=/);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectNoHorizontalScroll(page);

    await dialog
      .getByRole("button", { name: /increase completed models/i })
      .click();

    await page.reload();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/^1\s*\/\s*3$/).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("M6.3 library lookup → detail panel renders without clipping", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("mobile-lib"));

    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: /LIBRARY/i }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: /^filter/i }).click();
    const filterPanel = page.getByRole("dialog", { name: /^filter$/i });
    await expect(filterPanel).toBeVisible();
    const search = filterPanel.getByPlaceholder(/name, brand, sku/i);
    await expect(search).toBeVisible();
    await search.fill("Mephiston Red");
    await filterPanel.getByRole("button", { name: /close panel/i }).click();

    const firstHit = page.getByText(/Mephiston Red/i).first();
    await expect(firstHit).toBeVisible({ timeout: 15_000 });
    await firstHit.click({ force: true });

    const detail = page.locator(
      '[aria-label*="Mephiston Red detail" i]',
    );
    await expect(detail).toBeVisible({ timeout: 10_000 });
    // The drawer carries pb-20 on mobile so its footer clears the
    // bottom tab bar — verify by checking the detail panel does NOT
    // overflow the viewport bottom.
    const box = await detail.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
    }

    await expectNoHorizontalScroll(page);
  });
});

/**
 * P14.8 — PLANNER section mobile responsiveness.
 *
 * Explicit 375px viewport (iPhone SE / iPhone 12 mini class) — the
 * tightest viewport the brief locks. Asserts the PLANNER section
 * renders without horizontal scroll, every widget cell mounts, and
 * the mobile reorder lands Streak above Activity above Calendar (per
 * P14.8 spec).
 *
 * Tests sign in, create one project so /projects is past the empty
 * state, then read the rendered cell positions.
 */
test.describe("P14.8 — PLANNER mobile responsiveness", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("PLANNER renders without horizontal scroll at 375px viewport", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("planner-mobile"));

    // Create one project so /projects renders past EmptyState.
    await page.goto("/projects/new");
    const unique = `QA Planner Mobile ${Date.now()}`;
    await page
      .getByPlaceholder(/Tactical Squad Alpha/)
      .scrollIntoViewIfNeeded();
    await page.getByPlaceholder(/Tactical Squad Alpha/).fill(unique);
    await page.locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page).toHaveURL(/\/projects\?project=/);
    await page.goto("/projects");
    for (const cell of [/^PLANNER$/, /^EVENTS$/, /^ACTIVITY$/]) {
      await expect(page.getByRole("heading", { name: cell })).toBeVisible();
    }

    await expectNoHorizontalScroll(page);
  });

  test("dashboard rail stacks PLANNER above EVENTS above ACTIVITY on mobile", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("planner-order"));

    await page.goto("/projects/new");
    const unique = `QA Order Mobile ${Date.now()}`;
    await page.getByPlaceholder(/Tactical Squad Alpha/).fill(unique);
    await page.locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: /create project/i }).click();
    await expect(page).toHaveURL(/\/projects\?project=/);

    await page.goto("/projects");
    const planner = page.getByRole("heading", { name: /^PLANNER$/ });
    const events = page.getByRole("heading", { name: /^EVENTS$/ });
    const activity = page.getByRole("heading", { name: /^ACTIVITY$/ });
    await expect(planner).toBeVisible();
    await expect(events).toBeVisible();
    await expect(activity).toBeVisible();

    const plannerBox = await planner.boundingBox();
    const eventsBox = await events.boundingBox();
    const activityBox = await activity.boundingBox();
    expect(plannerBox).not.toBeNull();
    expect(eventsBox).not.toBeNull();
    expect(activityBox).not.toBeNull();
    if (plannerBox && eventsBox && activityBox) {
      expect(plannerBox.y).toBeLessThan(eventsBox.y);
      expect(eventsBox.y).toBeLessThan(activityBox.y);
    }
  });
});
