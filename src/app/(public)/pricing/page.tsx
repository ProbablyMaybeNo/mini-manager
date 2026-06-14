"use client";

import { useRouter } from "next/navigation";
import { PricingView } from "@/components/public/PricingView";
import { priceKeyForTierId } from "@/lib/billing/checkout";
import { mockPricingTiers } from "@/mock/fixtures";

export default function PricingPage() {
  const router = useRouter();

  async function handleChoose(tierId: string) {
    const priceKey = priceKeyForTierId(tierId);
    // Free tier (or anything without a Stripe price) → straight to sign-up.
    if (!priceKey) {
      router.push("/sign-up");
      return;
    }

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
      });

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

      // Any other failure (e.g. unauthenticated redirect handled upstream) —
      // send the visitor to sign-up as the safe default.
      router.push("/sign-up");
    } catch {
      router.push("/sign-up");
    }
  }

  return <PricingView tiers={mockPricingTiers} onChoose={handleChoose} />;
}
