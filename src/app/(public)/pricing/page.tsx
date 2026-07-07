"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PricingView } from "@/components/public/PricingView";
import { priceKeyForTierId } from "@/lib/billing/checkout";
import { BILLING_ENFORCED } from "@/lib/billing/plans";
import { mockPricingTiers } from "@/mock/fixtures";

function PricingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const autoResumed = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // `silent` is set for the post-login auto-resume so a still-unauthenticated
  // response doesn't bounce the user back to sign-in in a loop.
  async function startCheckout(tierId: string, opts?: { silent?: boolean }) {
    const priceKey = priceKeyForTierId(tierId);
    // Free tier (or anything without a Stripe price) → straight to sign-up.
    if (!priceKey) {
      router.push("/sign-up");
      return;
    }

    // Testing period: billing isn't enforced, so we never open a live Stripe
    // checkout — the whole app is free during the intro period. Paid CTAs just
    // route to sign-up (the silent auto-resume path stops instead of looping).
    if (!BILLING_ENFORCED) {
      if (!opts?.silent) router.push("/sign-up");
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
      });

      // Not signed in → send them to sign-in carrying the upgrade intent so
      // checkout resumes automatically once they're back here. On the silent
      // auto-resume path we stop instead, to avoid a redirect loop.
      if (res.status === 401) {
        if (opts?.silent) return;
        const back = `/pricing?upgrade=${encodeURIComponent(tierId)}`;
        router.push(`/sign-in?from=${encodeURIComponent(back)}`);
        return;
      }

      // Billing not configured yet → fall back to sign-up so the page still
      // works pre-Stripe-wire-up.
      if (res.status === 503) {
        router.push("/sign-up");
        return;
      }

      if (res.ok) {
        const { url } = (await res.json()) as { url?: string };
        if (url) {
          window.location.href = url;
          return;
        }
      }

      // A real failure (Stripe rejected the request, missing URL, etc.). The
      // user is authenticated here — surface the reason rather than bouncing
      // them off to sign-up.
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      setError(
        data.detail ?? data.error ?? "Could not start checkout. Please try again.",
      );
    } catch {
      setError("Could not reach checkout. Check your connection and try again.");
    }
  }

  // Resume an upgrade interrupted by sign-in (?upgrade=<tierId>). Fire once.
  useEffect(() => {
    const upgrade = params.get("upgrade");
    if (upgrade && !autoResumed.current) {
      autoResumed.current = true;
      void startCheckout(upgrade, { silent: true });
    }
    // startCheckout is stable for this purpose; only react to param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <>
      {error ? (
        <div
          role="alert"
          className="mx-auto max-w-2xl px-4 pt-4 font-body text-body text-red-text"
        >
          {error}
        </div>
      ) : null}
      <PricingView
        tiers={mockPricingTiers}
        betaFree={!BILLING_ENFORCED}
        onChoose={(tierId) => startCheckout(tierId)}
      />
    </>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingInner />
    </Suspense>
  );
}
