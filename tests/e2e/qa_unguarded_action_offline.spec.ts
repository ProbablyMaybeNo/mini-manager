import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * R2-14 — a rejected server action must not destroy the app, anywhere.
 *
 * Same shape R2-2, R2-9 and R2-10 each fixed a slice of: an `await`ed server
 * action inside a transition with no `try` and no `guarded()`. Every one of
 * these call sites handled `!res.ok` correctly; it was only the REJECTION path
 * — offline, a dropped connection, a 5xx from the action endpoint — that
 * escaped to `src/app/error.tsx`, the ROOT boundary, and replaced the entire
 * tree with the "SOMETHING BROKE" fault screen.
 *
 * These missions drive the real failure (`context.setOffline(true)`) on the
 * three highest-stakes surfaces named in the audit, and assert the page
 * survives it: no fault screen, the control still mounted and re-pressable,
 * and a message that says what happened.
 *
 * Companion to qa_password_reset_offline.spec.ts, which covers the same class
 * on the two `(public)` reset pages.
 */

const RETRYABLE = /check your connection, then try again/i;

/** The fault screen replaces the whole tree, so its absence is the assertion
 *  that the rejection stayed inside the component that made the call. */
async function expectNoFaultScreen(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: /something broke/i }),
  ).toHaveCount(0);
}

/**
 * Press until the press lands. A click that arrives before React attaches is a
 * no-op on these controls, and a no-op would satisfy "no fault screen" for
 * entirely the wrong reason — so every mission below asserts its message from
 * inside the retry, making an effective press part of the loop's exit
 * condition. Safe to repeat: the browser is offline, so nothing reaches the
 * server on any attempt.
 */
async function clickUntil(
  press: () => Promise<void>,
  assert: () => Promise<void>,
): Promise<void> {
  await expect(async () => {
    await press();
    await assert();
  }).toPass({ timeout: 60_000 });
}

test.describe("R2-14 — a rejected action no longer replaces the app", () => {
  test("R2-14.1 /sign-in reports the failure inline and keeps the typed username", async ({
    page,
    context,
  }) => {
    // The worst first impression the app can make: a flaky connection turning
    // "couldn't reach the server" into the whole-app fault screen, on the page
    // someone is using to get in.
    test.setTimeout(60_000);
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

    const username = page.getByLabel(/username/i);
    const password = page.getByLabel(/password/i);
    await expect(username).toBeVisible({ timeout: 30_000 });

    // Hydration probe — "Reveal characters" only works once React is attached.
    // A pre-hydration submit falls through to the bare <form>'s default GET,
    // which never calls the server action and would pass every assertion below
    // for the wrong reason.
    await expect(async () => {
      await page.getByRole("button", { name: "Reveal characters" }).click();
      await expect(password).toHaveAttribute("type", "text", { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const typed = "offlinepainter";
    await username.fill(typed);
    await password.fill("longenoughpw");

    await context.setOffline(true);
    await page.getByRole("button", { name: /^enter$/i }).click();

    await expect(page.getByText(RETRYABLE)).toBeVisible({ timeout: 30_000 });
    await expectNoFaultScreen(page);

    // Still the form, still holding what was typed, still pressable.
    await expect(username).toBeVisible();
    await expect(username).toHaveValue(typed);
    await expect(page.getByRole("button", { name: /^enter$/i })).toBeEnabled();

    await context.setOffline(false);
  });

  test("R2-14.2 the /r/<slug> clone button reports the failure and leaves the recipe on screen", async ({
    browser,
  }) => {
    // The highest-value click in the funnel: a stranger arriving from a shared
    // link. A crash here loses both the recipe they came to see and the account
    // they were about to make.
    test.setTimeout(120_000);
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    await signInAs(page, freshTestEmail("clone"));

    // --- Mint a real published recipe so /r/<slug> resolves ---
    const recipeName = `QA Offline Clone ${Date.now()}`;
    await page.goto("/recipes", { waitUntil: "domcontentloaded" });
    const createBtn = page.getByRole("button", { name: /^\+ NEW$/i });
    await expect(async () => {
      await createBtn.click();
      await page.waitForURL(/\/recipes\/new(\?|$)/, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    const nameField = page.getByLabel(/recipe name/i);
    await expect(nameField).toBeVisible({ timeout: 30_000 });
    await nameField.fill(recipeName);
    await page.getByRole("button", { name: /^Save Recipe$/i }).click();
    await page.waitForURL(/\/recipes$/, { timeout: 30_000 });

    const escaped = recipeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const row = page.getByRole("button", { name: new RegExp(`^${escaped}`) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await page.getByRole("button", { name: /share link/i }).click();
    await expect(
      page.getByText(/Public link copied to clipboard/i),
    ).toBeVisible({ timeout: 30_000 });
    const publicPath = new URL(
      await page.evaluate(() => navigator.clipboard.readText()),
    ).pathname;

    // --- The actual mission: clone it with the connection cut ---
    await page.goto(publicPath, { waitUntil: "domcontentloaded" });
    const clone = page.getByRole("button", { name: /clone to my library/i });
    await expect(clone).toBeVisible({ timeout: 30_000 });

    // Hydration gate. Cutting the connection before the page's JS has finished
    // arriving leaves it permanently un-hydrated — every click a no-op, which
    // would satisfy "no fault screen" without ever exercising the action.
    // ShareLinkBar rewrites its relative path to the absolute URL in an effect,
    // so an absolute URL on screen is proof React has mounted.
    await expect(page.getByText(new RegExp(`^https?://.+${publicPath}$`))).toBeVisible({
      timeout: 30_000,
    });

    await context.setOffline(true);
    await clickUntil(
      () => clone.click(),
      () =>
        expect(page.getByText(RETRYABLE)).toBeVisible({ timeout: 5_000 }),
    );
    await expectNoFaultScreen(page);

    // The recipe they arrived for is still rendered behind the message, and
    // the button is pressable again.
    await expect(
      page.getByRole("heading", { level: 1, name: recipeName }),
    ).toBeVisible();
    await expect(clone).toBeEnabled();

    await context.setOffline(false);
    await context.close();
  });

  test("R2-14.3 the focus bench survives a rejected progress bump", async ({
    page,
    context,
  }) => {
    // Six unguarded writes lived on this one screen. A painter mid-session has
    // a running stopwatch and a bench full of state; the fault screen took all
    // of it for a two-second signal drop.
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("focus"));

    // A project to focus — /focus falls back to projects[0] with no ?project.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /^PROJECTS$/ }),
    ).toBeVisible({ timeout: 30_000 });
    const addBtn = page.getByRole("button", { name: "New project", exact: true });
    const nameField = page.getByLabel("Name", { exact: true });
    await expect(async () => {
      await addBtn.click();
      await expect(nameField).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await page.getByRole("button", { name: "Close project inspector" }).click();

    await page.goto("/focus", { waitUntil: "domcontentloaded" });
    const bump = page.getByRole("button", { name: "Increase models painted" });
    await expect(bump).toBeVisible({ timeout: 30_000 });

    // Hydration gate — see R2-14.2. The focus picker's popup is client-only,
    // so opening it proves React has attached before the connection is cut.
    const picker = page.getByRole("combobox", { name: "Focus on project" });
    await expect(async () => {
      await picker.click();
      await expect(picker).toHaveAttribute("aria-expanded", "true", {
        timeout: 3_000,
      });
    }).toPass({ timeout: 30_000 });
    await page.keyboard.press("Escape");

    await context.setOffline(true);
    // The bench reports via toast (role=status), not an inline field error.
    await clickUntil(
      () => bump.click(),
      () =>
        expect(page.getByRole("status")).toContainText(RETRYABLE, {
          timeout: 5_000,
        }),
    );
    await expectNoFaultScreen(page);

    // Still the bench, still operable.
    await expect(bump).toBeVisible();
    await expect(bump).toBeEnabled();

    await context.setOffline(false);
  });
});
