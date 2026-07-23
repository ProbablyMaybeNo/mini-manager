"use client";

/**
 * Client-side trigger for Stripe Checkout — the one place every "Sponsor"
 * button (the gate dialog, /pricing) posts to `/api/billing/checkout`. NOT
 * used by the one-off "Feed the Mainframe" tip (Settings page) — that posts
 * to its own `/api/billing/sponsor-checkout` (see SponsorPanel.tsx).
 * Monthly only: the price key is hardcoded to `pro_monthly`, the sole tier
 * this app surfaces or sells (docs/SUBSCRIPTION_PAYWALL.md).
 */

export interface CheckoutResult {
  /** True when the browser is navigating away (to Stripe, or to sign-in to
   *  resume there) — the caller should just show a pending state and wait.
   *  False means the attempt failed outright and `error` is set. */
  ok: boolean;
  error?: string;
}

/**
 * POST /api/billing/checkout for `pro_monthly` and redirect the browser to
 * the returned Stripe URL. Handles the two non-happy paths inline so every
 * caller gets the same behaviour:
 *
 *   - 401 (signed out) — bounces to `/sign-in?from=<resumePath>` so signing
 *     in returns the visitor right back to the point of intent. `resumePath`
 *     defaults to the current location; pass it explicitly when the caller
 *     wants the return trip to carry extra state (e.g. /pricing's
 *     `?upgrade=pro-monthly` auto-resume).
 *   - anything else non-ok — returns a friendly error string instead of
 *     throwing, so the caller can render it inline.
 */
export async function startProMonthlyCheckout(opts?: {
  resumePath?: string;
}): Promise<CheckoutResult> {
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceKey: "pro_monthly" }),
    });

    if (res.status === 401) {
      const resumePath =
        opts?.resumePath ?? `${window.location.pathname}${window.location.search}`;
      window.location.href = `/sign-in?from=${encodeURIComponent(resumePath)}`;
      return { ok: true };
    }

    const body = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
      detail?: string;
    };

    if (!res.ok || !body.url) {
      return {
        ok: false,
        error: body.detail ?? body.error ?? "Could not start checkout. Try again.",
      };
    }

    window.location.href = body.url;
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server. Try again." };
  }
}
