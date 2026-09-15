import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { listPublishedRecipes } from "@/db/queries/recipes";
import { listMyGallerySubmissions } from "@/db/queries/gallerySubmissions";
import { EmptyState, Panel } from "@/components/kit";
import { PublicHeader } from "@/components/public/PublicHeader";
import { ShareYourModelButton } from "@/components/gallery/ShareYourModelButton";
import { YourCardsStrip } from "@/components/gallery/YourCardsStrip";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/structuredData";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { AnalyticsEvent } from "@/lib/analytics/events";
import { SUPPORT_EMAIL } from "@/lib/support";
import { GalleryBrowser } from "./GalleryBrowser";

// Published recipes change as painters share/unshare — render on request so
// a freshly shared recipe shows up without a rebuild.
export const dynamic = "force-dynamic";

const OG_TITLE = "Recipe Gallery — The Mini Mainframe";
const OG_DESCRIPTION =
  "Browse paint recipes shared by the community — colour schemes, swatches, and brands for your next miniature.";

export const metadata: Metadata = {
  title: OG_TITLE,
  description:
    "Browse paint recipes shared by the community — colour schemes, swatches, and brands for your next miniature, open to everyone on The Mini Mainframe.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    type: "website",
  },
  // R2-13 — overriding only `openGraph` left `twitter:*` falling through to the
  // root layout's generic block, and `twitter:*` wins over `og:*` on X. `card`
  // is restated because Next replaces a declared field wholesale instead of
  // merging into the parent's.
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
};

/**
 * The community gallery. Lives in the `(app)` group so signed-in painters get
 * it as a first-class page inside the sidebar shell; signed-out visitors (SEO,
 * shared links) still reach it — the proxy leaves `/gallery` public — and get
 * the marketing `PublicHeader` + footer instead of the app chrome.
 */
export default async function GalleryPage() {
  const [recipes, session] = await Promise.all([listPublishedRecipes(), auth()]);
  const userId = session?.user?.id;
  const isSignedIn = Boolean(userId);

  // "Your cards" — the signed-in painter's own submissions + moderation
  // status. Skipped entirely for signed-out visitors.
  const myCards = userId ? await listMyGallerySubmissions(userId) : [];

  const content = (
    // The gallery is a wall of painted models, so it is the one page that
    // should spend the width it has: at 1920 the 5xl cap left ~880px empty
    // and squeezed every card to 315px. Stepped at xl so phone and laptop
    // layouts are untouched — only genuinely wide screens widen, and the
    // intro paragraph keeps its own max-w-2xl so line length stays readable.
    <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-5 md:px-6 md:py-10 xl:max-w-[1600px]">
      <TrackPageView event={AnalyticsEvent.GalleryView} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Recipe Gallery", path: "/gallery" },
        ])}
      />
      {/* ~480px of intro, CTA, search, sort and count used to run before the
          first card (MUX-020). The paragraph now shows only from sm, so on a
          phone the header is the title and the share CTA — the grid of painted
          models explains itself faster than the sentence describing it. */}
      <header className="mb-4 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-title text-title uppercase text-cyan-lite text-glow-cyan">
            Recipe Gallery
          </h1>
          {/* `roomy:` — `sm` is true at 812×375, so landscape restored the
              paragraph and left ~47px of the first card visible (MUX3-008). */}
          <p className="hidden max-w-2xl font-body text-body text-fg roomy:block">
            Painted models and the exact recipes behind them, shared by the
            community. Browse the schemes, see the paints, and clone any card
            into your own library.
          </p>
        </div>
        {isSignedIn ? (
          <div className="shrink-0">
            <ShareYourModelButton />
          </div>
        ) : null}
      </header>

      {isSignedIn && <YourCardsStrip cards={myCards} />}

      {recipes.length === 0 ? (
        <Panel label="GALLERY" cornerTicks className="p-4">
          <EmptyState
            glyph="▦"
            title="No shared cards yet"
            hint={
              isSignedIn
                ? "Open a recipe, hit Share as Card, and Submit it to be the first card here."
                : "When painters share a model card it shows up here. Sign up and share the first one."
            }
          />
          <div className="flex justify-center pb-4">
            {isSignedIn ? (
              <ShareYourModelButton />
            ) : (
              <Link
                href="/sign-up"
                className="border border-cyan bg-cyan/15 px-4 py-2 font-button text-button uppercase tracking-[0.15em] text-cyan-lite hover:bg-cyan/25"
              >
                Get Started
              </Link>
            )}
          </div>
        </Panel>
      ) : (
        <GalleryBrowser recipes={recipes} isSignedIn={isSignedIn} />
      )}
    </main>
  );

  // Signed-in: the (app) layout already wraps us in AppShell (sidebar rail),
  // so render the content bare.
  if (isSignedIn) return content;

  // Signed-out: bring our own public chrome (AppShell renders nothing when
  // signed-out).
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      {content}
      <footer className="border-t border-cyan/20 px-6 py-6 text-center font-body text-body text-fg">
        ▸ THE MINI MAINFRAME · made for painters ·{" "}
        <Link href="/" className="text-cyan-lite underline">
          Home
        </Link>{" "}
        ·{" "}
        <Link href="/pricing" className="text-cyan-lite underline">
          Pricing
        </Link>{" "}
        ·{" "}
        <Link href="/sign-in" className="text-cyan-lite underline">
          Sign in
        </Link>{" "}
        ·{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
          Contact
        </a>
      </footer>
    </div>
  );
}
