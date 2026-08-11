import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M4 — Tools smoke E2E (current tool set).
 *
 * The hub lists four colour utilities (American "Color" spelling):
 * Color Wheel, Color Match, Color Dropper, Color Stacking. This spec
 * checks the hub renders all four, then walks the wheel path: open
 * /tools/wheel, confirm the harmony picker + "Send to Recipe" action,
 * and that Send to Recipe actually carries the scheme's colours into a
 * new recipe (Wave 2 / CIzKX — it used to navigate to /recipes with
 * nothing).
 */

test.describe("M4 — Tools", () => {
  test("M4.1 hub lists the four tools; wheel → Send to Recipe carries colours into a new recipe", async ({
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

    // Send to Recipe opens the create-or-assign chooser with the scheme's
    // colours (CIzKX) — type a name and Create to land on a new recipe.
    await page.getByRole("button", { name: /^Send to Recipe$/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByPlaceholder("New recipe name").fill("Wheel scheme E2E");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForURL(/\/recipes\/[^/?#]+$/, { timeout: 30_000 });
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

  /**
   * M4.3 — the Layering tool's whole promise: pick ONE paint you own, get told
   * exactly what to shade and highlight it with. Every layer and every ramp
   * step must name a real paint, because "#672622" is not something a painter
   * can buy.
   */
  test("M4.3 layering starts empty, and picking one layer fills the other two with real paints", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("layer"));

    await page.goto("/tools/stacking", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^COLOR STACKING$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Opens asking a question — three empty layers, no ramp yet.
    for (const lane of ["shadow", "base", "highlight"]) {
      await expect(
        page.getByRole("button", { name: `Choose a ${lane} paint` }),
      ).toBeVisible({ timeout: 30_000 });
    }
    await expect(page.getByText(/Click a layer above and choose a paint/)).toBeVisible();

    // Seed the BASE from the library.
    await page.getByRole("button", { name: "Choose a base paint" }).click();
    const picker = page.getByRole("dialog").first();
    await expect(picker).toBeVisible({ timeout: 20_000 });
    // A layer takes a paint, never a bare colour.
    await expect(picker.getByRole("button", { name: "Use this colour" })).toHaveCount(0);

    await picker
      .getByPlaceholder("Search by paint name, brand, or line…")
      .fill("mephiston");
    const row = picker.locator('ul[aria-label="Matching library paints"] li button').first();
    await row.waitFor({ state: "visible", timeout: 30_000 });
    await row.click();

    // All three layers now name a paint — the two derived ones included.
    for (const lane of ["Shadow", "Base", "Highlight"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${lane}: .+ by .+\\. Choose a different paint$`) }),
      ).toBeVisible({ timeout: 30_000 });
    }

    // And the ramp names paints rather than listing hexes.
    const rampRows = page.locator("ol li");
    await expect(rampRows.first()).toBeVisible({ timeout: 30_000 });
    const texts = await rampRows.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(t.trim()).not.toMatch(/^\d+\s*\n?\s*#[0-9A-Fa-f]{6}$/);
    }
  });

  /**
   * M4.4 — the UNDERCOAT section: coloured underpainting, as opposed to
   * LAYERING's value ramp. Pick the transparent paint going on top, pick a
   * goal, get a real paint to put underneath.
   *
   * The recommender existed for months but was wired to nothing, so this is
   * its first coverage at the UI level.
   */
  test("M4.4 undercoat recommends a real ground paint for the chosen goal", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("undercoat"));

    await page.goto("/tools/stacking", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^COLOR STACKING$/ }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByText(/we'll work out what to put under it/i),
    ).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("button", { name: "Choose the transparent paint going on top" })
      .click();
    const picker = page.getByRole("dialog", { name: /Pick the paint going on top/ });
    await expect(picker).toBeVisible({ timeout: 20_000 });
    await picker
      .getByPlaceholder("Search by paint name, brand, or line…")
      .fill("sand golem");
    const row = picker.locator('ul[aria-label="Matching library paints"] li button').first();
    await row.waitFor({ state: "visible", timeout: 30_000 });
    await row.click();

    // A warm khaki asked to go COOLER must land on an actually-cool ground.
    // This is the bug that shipped in the recommender: the hue rotation was
    // capped, so it recommended fluorescent green.
    await page.getByRole("radio", { name: "Cooler" }).click();
    const undercoatSwatch = page.locator('[aria-label^="Undercoat: #"]');
    await expect(undercoatSwatch).toBeVisible({ timeout: 20_000 });
    const hex = (await undercoatSwatch.getAttribute("aria-label"))!.replace("Undercoat: ", "");
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    // Cool ground: blue must lead, and it must not be a green cast.
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);

    // And the answer is given as real paints, not just a colour.
    await expect(page.getByText(/real paints to use/i)).toBeVisible();
    const suggestions = page.locator("li").filter({ hasText: /ASSIGN/i });
    expect(await suggestions.count()).toBeGreaterThan(0);

    // Candy switches the recommendation to metallics — only possible because
    // the catalog's Metallic type reaches the tools at all.
    await page.getByRole("radio", { name: "Candy" }).click();
    await expect(page.getByText(/real paints to use \(metallic\)/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
