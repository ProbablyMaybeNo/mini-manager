import { expect, test } from "@playwright/test";
import { freshTestEmail, signInAs } from "./_helpers/auth";

/**
 * M8 — Paid upgrade flow survives authentication.
 *
 * Regression: clicking a paid tier while signed out used to POST
 * /api/billing/checkout, hit a server-side redirect to /sign-in that fetch
 * followed opaquely, then dump the user on /sign-up → dashboard with the
 * upgrade intent lost ("enter credentials → dashboard, nothing happens").
 *
 * The route now returns a JSON 401 the client acts on: it bounces to sign-in
 * carrying ?from=/pricing?upgrade=<tier>, and on return auto-resumes checkout.
 *
 * SKIPPED during the free beta: with BILLING_ENFORCED=false the pricing page
 * short-circuits every paid CTA to /sign-up (no checkout POST, silent
 * auto-resume is a no-op), so this upgrade-intent flow doesn't exist yet.
 * Re-enable when BILLING_ENFORCED flips to true at the pricing lock date.
 */

test.describe.skip("M8 — Upgrade flow (paid checkout disabled during free beta)", () => {
  test("M8.1 signed-out 'Go Pro' bounces to sign-in carrying the upgrade intent", async ({
    page,
  }) => {
    // No sign-in — a fresh, anonymous visitor on the public pricing page.
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });

    // 401 → client redirects to /sign-in with the return path preserved.
    // Retry the click until it lands post-hydration (the button's handler may
    // not be wired on the very first paint on a slow dev filesystem).
    const goPro = page.getByRole("button", { name: /^Go Pro$/ });
    await expect(goPro).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      await goPro.click();
      await page.waitForURL(/\/sign-in\?from=/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    const from = new URL(page.url()).searchParams.get("from") ?? "";
    expect(from).toBe("/pricing?upgrade=pro-monthly");

    // Switching to "Create account" must NOT drop the intent — the link
    // carries ?from= through to /sign-up.
    const createLink = page.getByRole("link", { name: /Create account/i });
    const href = await createLink.getAttribute("href");
    expect(href).toContain("from=");
    expect(decodeURIComponent(href ?? "")).toContain("upgrade=pro-monthly");
  });

  test("M8.2 returning to /pricing?upgrade=… auto-resumes checkout", async ({
    page,
  }) => {
    await signInAs(page, freshTestEmail("upgrader"));

    // Stub the checkout endpoint so we exercise the client resume + redirect
    // without real Stripe. Capture the body to assert the right price key.
    let postedPriceKey: string | undefined;
    await page.route("**/api/billing/checkout", async (route) => {
      postedPriceKey = JSON.parse(route.request().postData() ?? "{}").priceKey;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        // Same-origin sentinel so window.location.href stays in-app.
        body: JSON.stringify({ url: "/pricing?checkout=mock-success" }),
      });
    });

    // Landing here is exactly what sign-in's ?from= redirect produces.
    await page.goto("/pricing?upgrade=pro-monthly", {
      waitUntil: "domcontentloaded",
    });

    // Auto-resume fires, hits the (stubbed) checkout, and redirects to the URL.
    await page.waitForURL(/\/pricing\?checkout=mock-success/, {
      timeout: 30_000,
    });
    expect(postedPriceKey).toBe("pro_monthly");
  });
});
