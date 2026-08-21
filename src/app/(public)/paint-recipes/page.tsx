import type { Metadata } from "next";
import Link from "next/link";
import { SeoLandingLayout } from "@/components/public/SeoLandingLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { PAINT_RECIPES_FAQ } from "@/lib/seo/landingFaq";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/structuredData";

const OG_TITLE = "Miniature Paint Recipes · The Mini Mainframe";
const OG_DESCRIPTION =
  "Build a miniature paint recipe layer by layer, tag the technique on every step, and save the colour scheme for the next unit. Share any recipe with a link and browse the gallery.";

export const metadata: Metadata = {
  title: OG_TITLE,
  description:
    "A paint recipe library for miniature painters. Build a colour scheme layer by layer from a 7,000+ paint catalog, tag the technique on every step, share any recipe with a link, and match a colour to the nearest paint in another brand. Free to start.",
  alternates: { canonical: "/paint-recipes" },
  // R2-13 — its own openGraph + twitter blocks, or a shared link unfurls as
  // the generic product page. The image is inherited from
  // (public)/opengraph-image.tsx and is correct.
  openGraph: { title: OG_TITLE, description: OG_DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: OG_TITLE, description: OG_DESCRIPTION },
};

export default function PaintRecipesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Paint Recipes", path: "/paint-recipes" },
        ])}
      />
      {/* FAQPage only — deliberately NOT Recipe schema: that vocabulary is
          food semantics and a paint scheme is not a dish. */}
      <JsonLd data={faqPageJsonLd(PAINT_RECIPES_FAQ)} />
      <SeoLandingLayout
        title="Paint Recipes"
        ctaLocation="paint-recipes"
        faq={PAINT_RECIPES_FAQ}
        faqHeading="Recipe questions"
        lede={
          <>
            A miniature paint recipe is the colour scheme written down: the paints in
            order, with the technique tagged on every step. The Mini Mainframe gives you a
            recipe library to build them in, a share link for every one, and a gallery of
            schemes from other painters to start from.
          </>
        }
        sections={[
          {
            heading: "Write the scheme down once",
            body: (
              <>
                <p>
                  Build a recipe layer by layer. Each step holds a real paint from the
                  7,000+ catalog — or a custom colour if you mixed it — plus the technique
                  it was applied with: undercoat, basecoat, shade, layer, highlight,
                  drybrush, detail. Add a note to any step for the bit you always forget,
                  like which thinner ratio worked.
                </p>
                <p>
                  A live preview shows the scheme as a strip of swatches while you build
                  it, and the finished recipe attaches to a project so it is waiting on the
                  bench next time you paint that unit.
                </p>
              </>
            ),
          },
          {
            heading: "Then repeat it a year later",
            body: (
              <p>
                The reason to keep a paint recipe library is the second batch. Six months
                after the first ten models, the recipe is still there with the exact pots
                and the order they went on in — so the reinforcements match the squad
                instead of being close enough to annoy you.
              </p>
            ),
          },
          {
            heading: "Share a recipe with a link",
            body: (
              <p>
                Every recipe has a public share link that opens for anyone, no account
                needed — the whole scheme, swatches, techniques and notes on one page. You
                can also render a recipe as a share card image, or publish it to the{" "}
                <Link href="/gallery" className="text-cyan-lite underline">
                  recipe gallery
                </Link>
                . Sharing and publishing are free.
              </p>
            ),
          },
          {
            heading: "Start from someone else's scheme",
            body: (
              <p>
                The gallery is browsable signed out. Find a scheme you like, clone it into
                your own recipe library in one click, and then edit it — swapping steps for
                paints you actually have in your{" "}
                <Link href="/paint-collection-manager" className="text-cyan-lite underline">
                  collection
                </Link>
                .
              </p>
            ),
          },
          {
            heading: "Paint conversion, one colour at a time",
            body: (
              <p>
                Painters rarely own the exact range a recipe was written in. Colour Match
                takes any paint or hex and ranks the nearest paints across the catalog by
                perceptual distance, filtered to the brands you choose — so a Citadel step
                becomes its closest Vallejo or Army Painter equivalent. It is a per-paint
                conversion, done a slot at a time; there is no one-click whole-recipe
                convert button. Colour Match, the colour wheel, the photo dropper and the
                layering tools are part of the{" "}
                <Link href="/pricing" className="text-cyan-lite underline">
                  Sponsor toolkit
                </Link>
                .
              </p>
            ),
          },
          {
            heading: "Or describe the scheme and let the AI draft it",
            body: (
              <p>
                Sponsors can write what they are after — a sun-bleached desert armour, a
                cold grimdark steel — and get a recipe back, built only from paints that
                exist in the catalog rather than invented colour names. It marks which
                paints you already own and offers to wishlist the rest. Every recipe it
                drafts is an ordinary recipe afterwards: edit it, attach it to a{" "}
                <Link
                  href="/miniature-wargame-project-tracker"
                  className="text-cyan-lite underline"
                >
                  project
                </Link>
                , share it.
              </p>
            ),
          },
        ]}
        related={[
          {
            href: "/paint-collection-manager",
            label: "Paint collection manager",
            blurb: "7,000+ paints across the major brands — mark what you own and wishlist the rest.",
          },
          {
            href: "/miniature-wargame-project-tracker",
            label: "Project tracker",
            blurb: "Armies, units, models and terrain with status, priority and deadlines.",
          },
          {
            href: "/gallery",
            label: "Recipe gallery",
            blurb: "Real schemes from other painters — browsable without an account.",
          },
          {
            href: "/pricing",
            label: "Sponsor the Mainframe",
            blurb: "$3.99/mo for Colour Match, the rest of the toolkit and AI recipes.",
          },
        ]}
        closing={
          <>
            Stop keeping colour schemes in screenshots and half-remembered pot names. Free
            to start, no card needed.
          </>
        }
      />
    </>
  );
}
