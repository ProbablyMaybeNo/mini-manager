"use client";

import { useRouter } from "next/navigation";
import { PricingView } from "@/components/public/PricingView";
import { mockPricingTiers } from "@/mock/fixtures";

export default function PricingPage() {
  const router = useRouter();
  return <PricingView tiers={mockPricingTiers} onChoose={() => router.push("/sign-up")} />;
}
