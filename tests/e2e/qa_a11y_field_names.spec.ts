import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * R5-3 — every field the painter can type into has a real name.
 *
 * R4-1 and R5-1 were the same bug in two places, found a round apart; R4-8 and
 * R5-2 likewise. The fix for THAT is not a third patch, it is a test that fails
 * when a new unnamed control appears. This walks the authenticated surfaces,
 * opens the dialogs this class of bug keeps turning up in, and asserts every
 * `input` / `textarea` / `select` is properly labelled.
 *
 * WHY IT DOES NOT JUST READ THE ACCESSIBLE NAME. Chrome's accname computation
 * falls back to `placeholder` when nothing else names a field, so the a11y tree
 * reports a name for a field that has no label at all. Verified on this app
 * before the fix: the AssignToRecipeDialog input exposed
 * `textbox "New recipe name"` from its placeholder alone, and R5-1's
 * delete-account field would have exposed the username the same way. A guard
 * built on "is the accessible name non-empty" therefore passes on all three of
 * the fields this batch fixed — it would have caught nothing.
 *
 * So the assertion is about MECHANISM, not string emptiness: a field must be
 * named by a `<label>`, `aria-label`, `aria-labelledby` or `title`. Placeholder
 * is not a label — it vanishes on the first keystroke, which is precisely when
 * a screen-reader user is mid-task.
 */

interface UnnamedField {
  tag: string;
  type: string;
  name: string;
  id: string;
  placeholder: string;
}

/** Every visible field on the page that no real labelling mechanism names. */
async function unnamedFields(page: Page): Promise<UnnamedField[]> {
  return page.evaluate(() => {
    // Button-ish input types take their name from `value` / `alt`; they are
    // controls, not fields, and `hidden` is not in the a11y tree at all.
    const NOT_A_FIELD = new Set([
      "hidden",
      "submit",
      "button",
      "reset",
      "image",
    ]);
    const out: UnnamedField[] = [];
    const nodes = document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select");

    for (const el of Array.from(nodes)) {
      if (el instanceof HTMLInputElement && NOT_A_FIELD.has(el.type)) continue;
      // Not rendered, or explicitly removed from the a11y tree — a screen
      // reader never reaches these, so they are not this test's business.
      if (!el.checkVisibility()) continue;
      if (el.closest('[aria-hidden="true"], [inert]')) continue;

      const labelled = Array.from(el.labels ?? []).some(
        (l) => (l.textContent ?? "").trim().length > 0,
      );
      const ariaLabel = (el.getAttribute("aria-label") ?? "").trim();
      const labelledBy = (el.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => (document.getElementById(id)?.textContent ?? "").trim())
        .join(" ")
        .trim();
      const title = (el.getAttribute("title") ?? "").trim();

      if (labelled || ariaLabel || labelledBy || title) continue;

      out.push({
        tag: el.tagName.toLowerCase(),
        type: el instanceof HTMLInputElement ? el.type : "",
        name: el.getAttribute("name") ?? "",
        id: el.id,
        placeholder: el.getAttribute("placeholder") ?? "",
      });
    }
    return out;
  });
}

async function expectEveryFieldNamed(page: Page, where: string): Promise<void> {
  const unnamed = await unnamedFields(page);
  expect(
    unnamed.map(
      (f) =>
        `${where} · <${f.tag}${f.type ? ` type=${f.type}` : ""} name="${f.name}" id="${f.id}" placeholder="${f.placeholder}"> has no <label>, aria-label, aria-labelledby or title`,
    ),
    `unnamed fields on ${where}`,
  ).toEqual([]);
}

/**
 * The first-run tutorial and the PWA install prompt are overlays that can sit
 * on top of the controls this test clicks. Dismiss them if they are up; never
 * fail because they are not.
 */
async function dismissOverlays(page: Page): Promise<void> {
  for (const name of [/^Skip$/, /^Not now$/, /Dismiss install prompt/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
    }
  }
}

test.describe("R5-3 — no unnamed fields", () => {
  test("the authenticated routes expose no unnamed field", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, freshTestEmail("a11y-names"));

    const routes = [
      "/dashboard",
      "/library",
      "/collection",
      "/recipes",
      "/tools",
      "/focus",
      "/gallery",
      "/user",
    ];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      // The surfaces render their fields client-side after hydration; wait for
      // the page's own heading rather than a bare timeout.
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 30_000,
      });
      await dismissOverlays(page);
      await expectEveryFieldNamed(page, `route ${route}`);
    }
  });

  test("the dialogs this bug keeps appearing in expose no unnamed field", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signInAs(page, freshTestEmail("a11y-dialogs"));

    // ── The project inspector — the app's main editing surface ──────────────
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await dismissOverlays(page);
    await page
      .getByRole("button", { name: /^\+ Create your first project$/ })
      .click();
    await expect(
      page.locator('[role="dialog"], section[aria-label="Project inspector"]').first(),
    ).toBeVisible({ timeout: 20_000 });
    await expectEveryFieldNamed(page, "dialog: project inspector");

    // ── The delete-account dialog — R5-1's ─────────────────────────────────
    await page.goto("/user", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 30_000,
    });
    await dismissOverlays(page);
    await page.getByRole("button", { name: /^Delete account…$/ }).click();
    await expect(
      page.getByRole("dialog", { name: /delete account/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expectEveryFieldNamed(page, "dialog: delete account");
    await page.keyboard.press("Escape");

    // ── The library filter panel — R5-3's own `filter-search` ──────────────
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^LIBRARY$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await dismissOverlays(page);
    await page.getByRole("button", { name: /^Filter/ }).click();
    await expect(page.locator('input[name="filter-search"]')).toBeVisible({
      timeout: 20_000,
    });
    await expectEveryFieldNamed(page, "panel: library filters");

    // ── AssignToRecipeDialog — R5-3's `new-recipe-name` ────────────────────
    await page.goto("/tools/wheel", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^COLOR WHEEL$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await dismissOverlays(page);
    await page.getByRole("button", { name: /^Send to Recipe$/ }).click();
    await expect(
      page.getByRole("dialog", { name: /assign to recipe/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expectEveryFieldNamed(page, "dialog: assign to recipe");
  });
});
