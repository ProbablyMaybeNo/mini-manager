import { expect, test, type Page } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * R2-15 — a rejected action must not leave the control permanently dead.
 *
 * Distinct from R2-14's crash class: these are plain async event handlers, not
 * transitions, so nothing reaches the error boundary and nothing visibly
 * breaks. They set a loading flag, `await` with no `try`, and clear the flag on
 * the NEXT line — so on a rejection the clear never runs. The flag stays set
 * forever, an early-return guard turns every later click into a no-op, and
 * nothing is shown. Dead until a full page reload, with no clue why.
 *
 * The fix is `try/finally` (the flag always clears) plus a message on the
 * failure path. These missions assert the second press works, which is the
 * whole difference.
 */

const RETRYABLE = /check your connection, then try again/i;

/** Neither surface here should ever reach the error boundary — but if a fix
 *  ever converted a stuck flag into a crash, that would pass "the button is
 *  enabled" while being strictly worse. Assert it explicitly. */
async function expectNoFaultScreen(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: /something broke/i }),
  ).toHaveCount(0);
}

test.describe("R2-15 — a rejected action leaves the control alive", () => {
  test("R2-15.1 the planner's Add stays pressable after a failed create", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("planner"));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Opening the form is pure client state, so it doubles as the hydration
    // gate: cutting the connection before React attaches would leave the page
    // permanently inert, and an inert page can't prove anything about pending
    // flags.
    const openForm = page.getByRole("button", { name: /\+ ADD DATE/i }).first();
    const eventName = page.getByLabel("Event", { exact: true });
    await expect(async () => {
      await openForm.click();
      await expect(eventName).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });

    const typed = "Offline Open Day";
    await eventName.fill(typed);
    await page.getByLabel("Date", { exact: true }).fill("2026-09-12");

    const add = page.getByRole("button", { name: /^Add$/ });
    await expect(add).toBeEnabled();

    await context.setOffline(true);
    await add.click();

    // It says what happened…
    await expect(page.getByText(RETRYABLE)).toBeVisible({ timeout: 30_000 });
    await expectNoFaultScreen(page);

    // …and — the actual regression — the button comes back out of "Adding…"
    // instead of staying disabled forever with the event still typed in.
    await expect(add).toBeEnabled({ timeout: 15_000 });
    await expect(add).toHaveText(/^Add$/);
    await expect(eventName).toHaveValue(typed);

    // A second press is still a real press: it goes busy and returns.
    await add.click();
    await expect(add).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByText(RETRYABLE)).toBeVisible();

    await context.setOffline(false);
  });

  test("R2-15.3 the tools ASSIGN menu comes back after a failed inventory write", async ({
    page,
    context,
  }) => {
    // `pending` here gates BOTH menu entries and the ASSIGN button itself, so
    // the stuck flag took Add to Owned and Add to Wishlist down together.
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("assign"));
    await page.goto("/tools/wheel", { waitUntil: "domcontentloaded" });

    const assign = page.getByRole("button", { name: "Assign", exact: true }).first();
    await expect(assign).toBeVisible({ timeout: 30_000 });

    // Opening the menu is client-only state AND proves the paint catalog
    // resolved a real match — the inventory entries only render for a swatch
    // with a catalog `paintId`.
    const addToOwned = page.getByRole("menuitem", { name: /add to owned/i });
    await expect(async () => {
      await assign.click();
      await expect(addToOwned).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });

    await context.setOffline(true);
    await addToOwned.click();

    await expect(page.getByRole("status")).toContainText(RETRYABLE, {
      timeout: 30_000,
    });
    await expectNoFaultScreen(page);

    // The regression: ASSIGN used to stay disabled forever after this.
    await expect(assign).toBeEnabled({ timeout: 15_000 });
    await assign.click();
    await expect(addToOwned).toBeVisible({ timeout: 15_000 });

    await context.setOffline(false);
  });

  test("R2-15.2 resend-verification recovers instead of sticking on Sending…", async ({
    page,
    context,
  }) => {
    // The account-recovery one. The signup link lasts an hour and is sent
    // exactly once; miss it and this button is the only way back. A dead
    // button here locks the account out of every `emailVerified` feature.
    test.setTimeout(90_000);
    await signInAs(page, freshTestEmail("resend"));
    await page.goto("/user", { waitUntil: "domcontentloaded" });

    const resend = page.getByRole("button", {
      name: /resend verification email/i,
    });
    await expect(resend).toBeVisible({ timeout: 30_000 });

    // Hydration gate — the density toggle is pure client state.
    const compact = page.getByRole("radio", { name: /compact/i });
    await expect(async () => {
      await compact.click();
      await expect(compact).toHaveAttribute("aria-checked", "true", {
        timeout: 3_000,
      });
    }).toPass({ timeout: 60_000 });

    await context.setOffline(true);
    await resend.click();

    await expect(page.getByText(RETRYABLE)).toBeVisible({ timeout: 30_000 });
    await expectNoFaultScreen(page);

    await expect(resend).toBeEnabled({ timeout: 15_000 });
    await expect(resend).toHaveText(/resend verification email/i);

    // Still a live control on the second press.
    await resend.click();
    await expect(resend).toBeEnabled({ timeout: 15_000 });

    await context.setOffline(false);
  });
});
