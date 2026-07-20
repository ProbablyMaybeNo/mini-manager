import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicPageTitle } from "@/components/public/PublicPageTitle";
import { PricingClient } from "@/components/public/PricingClient";

export const metadata: Metadata = {
  title: "Support the Mainframe · The Mini Mainframe",
  description:
    "The Mini Mainframe's base app — projects, the paint library, recipes, and collection tracking — is yours from the start. Subscribe for $3.99/mo to unlock the full colour toolkit, Paint Scanner, and AI recipe generation.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 p-6 text-center">
        <PublicPageTitle>SUPPORT</PublicPageTitle>
        <PricingClient />
      </main>
    </div>
  );
}
