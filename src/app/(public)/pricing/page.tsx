import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicPageTitle } from "@/components/public/PublicPageTitle";
import { PricingClient } from "@/components/public/PricingClient";

const OG_TITLE = "Sponsor the Mainframe · The Mini Mainframe";
const OG_DESCRIPTION =
  "The base app is yours from the start. Sponsor the Mainframe for $3.99/mo to unlock the full colour toolkit, Paint Scanner, and AI recipe generation.";

export const metadata: Metadata = {
  title: OG_TITLE,
  description:
    "The Mini Mainframe's base app — projects, the paint library, recipes, and collection tracking — is yours from the start. Sponsor the Mainframe for $3.99/mo to unlock the full colour toolkit, Paint Scanner, and AI recipe generation.",
  alternates: { canonical: "/pricing" },
  // R2-13 — /pricing was a step worse than the recipe pages it was grouped
  // with: it declared NEITHER block, so BOTH `og:title` and `twitter:title`
  // fell through to the root layout and a shared pricing link unfurled as the
  // generic product page. Verified in a real browser before the fix — the
  // page's own title existed only in `<title>`, which no unfurl reads.
  // The image is inherited from `(public)/opengraph-image.tsx` and is correct.
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
};

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 p-6 text-center">
        <PublicPageTitle>SPONSOR</PublicPageTitle>
        <PricingClient />
      </main>
    </div>
  );
}
