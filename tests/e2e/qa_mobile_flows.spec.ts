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
  test("M6.1 bottom tab bar visible and navigates", async ({ page }) => {
    await signInAs(page, freshTestEmail("mobile"));

    await page.goto("/projects");
    // Mobile-only chrome (md:hidden on the bar). The bar carries
    // aria-label="Primary".
    const tabbar = page.locator("nav[aria-label='Primary'].md\\:hidden");
    await expect(tabbar).toBeVisible();
    await expectNoHorizontalScroll(page);

    const destinations: Array<{ label: string; pathRe: RegExp }> = [
      { label: "Library", pathRe: /\/library/ },
      { label: "Recipes", pathRe: /\/recipes/ },
      { label: "Tools", pathRe: /\/tools/ },
      { label: "Wishlist", pathRe: /\/wishlist/ },
      { label: "Projects", pathRe: /\/projects/ },
    ];

    for (const dest of destinations) {
      // The Next.js dev overlay floats at the bottom-right of the
      // viewport on mobile in dev, which can intercept clicks on the
      // last tabs of the bottom tab bar (Tools / Wishlist). Use a DOM
      // `link.click()` to trigger navigation without going through the
      // hit-test stack — the production build doesn't have the dev
      // overlay so this is a test-only workaround.
      const link = tabbar.getByRole("link", { name: dest.label, exact: true });
      await link.evaluate((el) => (el as HTMLAnchorElement).click());
      await page.waitForURL(dest.pathRe, { timeout: 10_000 });
      await expectNoHorizontalScroll(page);
      const active = tabbar.locator("a[aria-current='page']");
      await expect(active).toHaveCount(1);
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

    await expect(page).toHaveURL(/\/projects\/[a-zA-Z0-9_-]{16}$/);
    await expectNoHorizontalScroll(page);

    // Owned first (cascade: build ≤ owned), then Build.
    const ownedBtn = page.getByRole("button", { name: /Increment Owned/i });
    await ownedBtn.scrollIntoViewIfNeeded();
    await ownedBtn.click();
    const buildBtn = page.getByRole("button", { name: /Increment Build/i });
    await buildBtn.scrollIntoViewIfNeeded();
    await buildBtn.click();

    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(unique, "i") }),
    ).toBeVisible();
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

    // Mobile only renders the [ Filters ] pill — the search input is
    // inside the bottom-sheet drawer. Open it.
    const filtersBtn = page.getByRole("button", { name: /open filters/i });
    await expect(filtersBtn).toBeVisible();
    await filtersBtn.click({ force: true });

    // Both the desktop FilterRail (display:none on mobile) AND the
    // drawer's FilterRail are mounted, so scope the search input to
    // the drawer's <aside aria-label="Library filters drawer">
    // wrapper to avoid strict-mode "resolved to 2 elements".
    const drawer = page.locator(
      'aside[aria-label="Library filters drawer"]',
    );
    const search = drawer.getByPlaceholder(/Name, brand, sku/);
    await expect(search).toBeVisible();
    await search.fill("Mephiston Red");

    // The drawer auto-closes when a filter commits; wait for it to
    // disappear (the page resumes layout).
    await expect(filtersBtn).toBeVisible({ timeout: 15_000 });

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
