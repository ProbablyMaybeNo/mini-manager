import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * UX-002 — clicking a recipe slot opens the FULL paint-creator toolset
 * (wheel + filterable library + dropper + match + layering), matching the
 * Figma Recipe.png right-rail, and assigning a paint updates that slot.
 */
test.describe("UX-002 — recipe slot full paint toolset", () => {
  test("slot picker exposes all tools and assigns a paint to the slot", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail());

    await page.goto("/recipes/new", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Adding a slot auto-opens the picker on that slot.
    await page.getByRole("button", { name: "+ Add slot" }).click();

    const dialog = page.getByRole("dialog", { name: "Pick a paint" });
    await expect(dialog).toBeVisible();

    // The full toolset is present as tabs.
    await expect(page.getByRole("tab", { name: "Wheel · Library" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Match" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Dropper" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Layering" })).toBeVisible();

    // Match tab renders the ranked-matches surface.
    await page.getByRole("tab", { name: "Match" }).click();
    await expect(page.getByText("RANKED MATCHES")).toBeVisible();

    // Layering tab renders the ramp surface.
    await page.getByRole("tab", { name: "Layering" }).click();
    await expect(page.getByText("LAYERING").first()).toBeVisible();

    // Back to the library list: search, then assign the first match to the slot.
    await page.getByRole("tab", { name: "Wheel · Library" }).click();
    await page
      .getByPlaceholder("Search by paint name, brand, or line…")
      .fill("red");

    const firstMatch = page
      .getByRole("button")
      .filter({ hasText: /ΔE/ })
      .first();
    await firstMatch.waitFor({ state: "visible", timeout: 30_000 });
    const matchName = (await firstMatch.innerText()).split("\n")[0].trim();
    await firstMatch.click();

    await page.getByRole("button", { name: "Close panel" }).click();

    // The slot row now reflects the assigned paint.
    await expect(page.getByText(matchName, { exact: false }).first()).toBeVisible();
  });
});
