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
    // /recipes/new compiles a large editor + loads the paint catalog;
    // give the test a generous budget under parallel dev-server load.
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail());

    await page.goto("/recipes/new", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });

    // Adding a slot auto-opens the picker via React state (setPickingSlot).
    // Retry the click + dialog-mount check until the island has hydrated and
    // the SlideOutPanel renders (guards a pre-hydration click miss).
    const dialog = page.getByRole("dialog", { name: "Pick & Paint" });
    await expect(async () => {
      await page.getByRole("button", { name: "+ Add Paint" }).click();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // The full toolset is present as tabs. Wheel is NOT one of them any more:
    // the paywall split it out of Library, and splitting it broke the thing it
    // was part of — the library list ranks by ΔE against the wheel's colour, so
    // a Wheel tab with no list showed a colour with no matches and a Library
    // tab ranked against a colour you could not see. They are one tab again,
    // with the wheel gated inside it instead.
    await expect(page.getByRole("tab", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Wheel" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Match" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Dropper" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Layering" })).toBeVisible();

    // The merge's actual contract, and the reason it exists: for a subscriber
    // (test users are comped — see /api/test/sign-in) the wheel and the paint
    // list it ranks are on screen AT THE SAME TIME.
    await expect(dialog.getByRole("heading", { name: "Wheel" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Library" })).toBeVisible();
    // The company filter is a popover now, not a wall of 39 checkboxes below
    // the list: closed until asked for, and dismissed by clicking away.
    const filter = dialog.getByRole("button", { name: "Filter by paint company" });
    await expect(filter).toHaveAttribute("aria-expanded", "false");
    await filter.click();
    await expect(filter).toHaveAttribute("aria-expanded", "true");
    await dialog.getByRole("heading", { name: "Library" }).click();
    await expect(filter).toHaveAttribute("aria-expanded", "false");

    // Match tab renders the ranked-matches surface.
    await page.getByRole("tab", { name: "Match" }).click();
    await expect(page.getByText("RANKED MATCHES")).toBeVisible();

    // Layering tab renders the ramp surface.
    await page.getByRole("tab", { name: "Layering" }).click();
    await expect(page.getByText("LAYERING").first()).toBeVisible();

    // Back to the library list: search, then assign the first match to the slot.
    await page.getByRole("tab", { name: "Library" }).click();
    await page
      .getByPlaceholder("Search by paint name, brand, or line…")
      .fill("red");

    const firstMatch = page
      .getByRole("button")
      .filter({ hasText: /ΔE/ })
      .first();
    await firstMatch.waitFor({ state: "visible", timeout: 30_000 });
    const matchName = (await firstMatch.innerText()).split("\n")[0].trim();
    // A single click on a library paint selects it and closes the panel
    // immediately (no separate confirm step).
    await firstMatch.click();
    await expect(dialog).not.toBeVisible();

    // The slot row now reflects the assigned paint.
    await expect(page.getByText(matchName, { exact: false }).first()).toBeVisible();
  });

  /**
   * A recipe slot only ever holds a catalog paint (UX_FEEDBACK_2026-06-03 B2,
   * which removed the "Use hex" add path). That decision was silently undone
   * when the June rebuild put this panel on the SHARED ColorPicker, where
   * emitting a bare hex is correct for the colour tools — nothing failed, so
   * nobody noticed for two months.
   *
   * This is the test that would have caught it: no control in the recipe
   * picker may commit a colour that isn't a paint.
   */
  test("no path in the recipe picker can put a bare colour in a slot", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail());

    await page.goto("/recipes/new", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const dialog = page.getByRole("dialog", { name: "Pick & Paint" });
    await expect(async () => {
      await page.getByRole("button", { name: "+ Add Paint" }).click();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // The two controls that used to commit a raw hex are gone.
    await expect(dialog.getByRole("button", { name: "Use this colour" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /^Use harmony swatch/ })).toHaveCount(0);

    // The harmony swatches survive, but they AIM the wheel rather than fill
    // the slot — so they still drive the ranked list, which is the point.
    const aim = dialog.getByRole("button", { name: /^Match paints to harmony swatch/ });
    await expect(aim.first()).toBeVisible();

    const wheelHex = async () =>
      (await dialog.locator("section").first().innerText()).match(/#[0-9A-Fa-f]{6}/)?.[0];
    const topMatch = async () =>
      dialog.locator('ul[aria-label="Matching library paints"] li').first().innerText();

    const beforeHex = await wheelHex();
    const beforeTop = await topMatch();
    // nth(1) — swatch 0 of a complementary harmony IS the current colour, so
    // clicking it is a no-op and would prove nothing.
    await aim.nth(1).click();

    await expect(dialog).toBeVisible();
    await expect.poll(wheelHex).not.toBe(beforeHex);
    await expect.poll(topMatch).not.toBe(beforeTop);
  });

  /**
   * Inverted 2026-09-05. This used to assert that a free-tier painter got the
   * library WITHOUT the wheel, and that the tool tabs announced themselves as
   * locked — the picker's whole tool surface was subscriber-only.
   *
   * The paid line moved to "does this cost money to run", and none of the
   * picker does: the wheel, Match, Dropper and Layering are client-side colour
   * maths. So the assertion flips, and it is worth keeping in this direction —
   * it proves the un-gating actually reached the UI for a REAL free-tier user
   * rather than the comped default, which is exactly the leak the original
   * version of this test existed to catch, just pointing the other way.
   */
  test("a free-tier painter gets the whole picker — wheel and every tool tab", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAs(page, freshTestEmail("free"), { comp: false });

    await page.goto("/recipes/new", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^RECIPE EDITOR$/ }),
    ).toBeVisible({ timeout: 30_000 });

    const dialog = page.getByRole("dialog", { name: "Pick & Paint" });
    await expect(async () => {
      await page.getByRole("button", { name: "+ Add Paint" }).click();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    // The Library tab still leads with search — that part never changed.
    await expect(dialog.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(
      dialog.getByPlaceholder("Search by paint name, brand, or line…"),
    ).toBeVisible();

    // ...but the wheel section above it is now there for a free user, sliders
    // and all. These two were `toHaveCount(0)` before.
    await expect(dialog.getByRole("heading", { name: "Wheel" })).toBeVisible();
    await expect(dialog.getByRole("slider", { name: "Saturation" })).toBeVisible();

    // And no tab carries the lock affordance any more — the accessible name
    // is the plain label, with no "sponsor access only" suffix.
    await expect(
      page.getByRole("tab", { name: "Dropper — sponsor access only" }),
    ).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Dropper" })).toBeVisible();
  });
});
