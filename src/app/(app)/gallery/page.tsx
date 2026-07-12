import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { listPublishedRecipes } from "@/db/queries/recipes";
import { EmptyState, Panel } from "@/components/kit";
import { PublicHeader } from "@/components/public/PublicHeader";
import { GalleryBrowser } from "./GalleryBrowser";

// Published recipes change as painters share/unshare — render on request so
// a freshly shared recipe shows up without a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recipe Gallery — The Mini Mainframe",
  description:
    "Browse paint recipes shared by the community — colour schemes, swatches, and brands for your next miniature. Free to view on The Mini Mainframe.",
  openGraph: {
    title: "Recipe Gallery — The Mini Mainframe",
    description:
      "Browse paint recipes shared by the community — colour schemes, swatches, and brands for your next miniature.",
    type: "website",
  },
};

export default async function GalleryPage() {
  const [recipes, session] = await Promise.all([listPublishedRecipes(), auth()]);
  const isSignedIn = Boolean(session?.user?.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <header className="mb-8 flex flex-col gap-2">
          <h1 className="font-title text-title uppercase text-cyan-lite text-glow-cyan">
            Recipe Gallery
          </h1>
          <p className="max-w-2xl font-body text-body text-fg">
            Paint recipes shared by the community. Browse the colour schemes,
            see the exact paints, and open any recipe to copy it into your own
            library.
          </p>
        </header>

        {recipes.length === 0 ? (
          <Panel label="GALLERY" cornerTicks className="p-4">
            <EmptyState
              glyph="▦"
              title="No shared recipes yet"
              hint="When painters share a recipe it shows up here. Sign up and publish the first one."
            />
            <div className="flex justify-center pb-4">
              <Link
                href="/sign-up"
                className="border border-cyan bg-cyan/15 px-4 py-2 font-button text-button uppercase tracking-[0.15em] text-cyan-lite hover:bg-cyan/25"
              >
                Start for Free
              </Link>
            </div>
          </Panel>
        ) : (
          <GalleryBrowser recipes={recipes} isSignedIn={isSignedIn} />
        )}
      </main>

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
