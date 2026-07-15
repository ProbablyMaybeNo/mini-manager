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
import { GalleryBrowser } from "./GalleryBrowser";

// Published recipes change as painters share/unshare — render on request so
// a freshly shared recipe shows up without a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recipe Gallery — The Mini Mainframe",
  description:
    "Browse paint recipes shared by the community — colour schemes, swatches, and brands for your next miniature. Free to view on The Mini Mainframe.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "Recipe Gallery — The Mini Mainframe",
    description:
      "Browse paint recipes shared by the community — colour schemes, swatches, and brands for your next miniature.",
    type: "website",
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Recipe Gallery", path: "/gallery" },
        ])}
      />
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-title text-title uppercase text-cyan-lite text-glow-cyan">
            Recipe Gallery
          </h1>
          <p className="max-w-2xl font-body text-body text-fg">
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
                Start for Free
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
        <Link href="/" className="text-cyan-lite hover:underline">
          Home
        </Link>{" "}
        ·{" "}
        <Link href="/pricing" className="text-cyan-lite hover:underline">
          Pricing
        </Link>{" "}
        ·{" "}
        <Link href="/sign-in" className="text-cyan-lite hover:underline">
          Sign in
        </Link>
      </footer>
    </div>
  );
}
