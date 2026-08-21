import type { Metadata } from "next";
import Link from "next/link";
import { SeoLandingLayout } from "@/components/public/SeoLandingLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { PAINT_COLLECTION_FAQ } from "@/lib/seo/landingFaq";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/structuredData";

const OG_TITLE = "Paint Collection Manager for Miniature Painters · The Mini Mainframe";
const OG_DESCRIPTION =
  "Track your miniature paint collection in one place — search 7,000+ paints across Citadel, Vallejo, Army Painter and more, mark what you own, wishlist the rest, and see what the pile cost.";

export const metadata: Metadata = {
  title: OG_TITLE,
  description:
    "A paint collection manager for miniature painters. Search a 7,000+ paint library across Citadel, Vallejo, Army Painter and Scale75, mark every pot you own, wishlist the rest, and track your miniature paint inventory and what it cost. Free to start.",
  alternates: { canonical: "/paint-collection-manager" },
  // Its OWN openGraph + twitter blocks (R2-13): a page that declares neither
  // falls through to the root layout and unfurls as the generic product page.
  // The image is inherited from (public)/opengraph-image.tsx, which is correct.
  openGraph: { title: OG_TITLE, description: OG_DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: OG_TITLE, description: OG_DESCRIPTION },
};

export default function PaintCollectionManagerPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Paint Collection Manager", path: "/paint-collection-manager" },
        ])}
      />
      <JsonLd data={faqPageJsonLd(PAINT_COLLECTION_FAQ)} />
      <SeoLandingLayout
        title="Paint Collection Manager"
        ctaLocation="paint-collection-manager"
        faq={PAINT_COLLECTION_FAQ}
        faqHeading="Paint collection questions"
        lede={
          <>
            The Mini Mainframe is a paint collection manager for miniature painters. Search
            a library of 7,000+ paints across the major brands, flag every pot you own,
            wishlist the ones you don&apos;t, and stop buying the same colour twice.
          </>
        }
        sections={[
          {
            heading: "Know what you already own",
            body: (
              <>
                <p>
                  Most painting collections live in a drawer and a vague memory of what is
                  in it. The paint library puts every paint on the market in one searchable
                  grid, mapped by colour, and every paint carries one of three states:
                  owned, wishlisted, or neither. Tap through them as you unpack a shelf and
                  your miniature paint inventory builds itself.
                </p>
                <p>
                  Filter by brand, by paint type, or by hue family, and search by name — so
                  &ldquo;did I already buy a mid-grey?&rdquo; is a five-second question in
                  a shop rather than a gamble at the till.
                </p>
              </>
            ),
          },
          {
            heading: "One inventory, every brand",
            body: (
              <>
                <p>
                  Real racks are mixed. The library covers 7,000+ paints across brands
                  including Citadel, Vallejo, Army Painter, Scale75, AK Interactive and
                  Reaper, so a shelf that grew one Christmas present at a time still reads
                  as a single collection instead of one list per range.
                </p>
                <p>
                  Because everything sits in one colour-mapped library, a gap is visible as
                  a gap — the browns you have four of, and the desaturated greens you have
                  none of.
                </p>
              </>
            ),
          },
          {
            heading: "Track the models too, and what they cost",
            body: (
              <>
                <p>
                  The collection page holds two tables: paints, and models. Both carry
                  quantity, price, the project they belong to, and a status from wishlist
                  through to complete. A stats bar totals what you have spent and what the
                  wishlist would cost if you bought it tomorrow, per project and overall.
                </p>
                <p>
                  Paste a product link from one of the supported stores and the row fills
                  in its own name, image and price. Links from anywhere else still create a
                  row with the link attached — you just type the name.
                </p>
              </>
            ),
          },
          {
            heading: "Scan the rack instead of typing it",
            body: (
              <p>
                Sponsors can photograph a shelf of pots and let the Paint Scanner read the
                labels, match them against the catalog, and add the confirmed ones to the
                collection in bulk. Nothing is saved until you have checked the matches. It
                is the fastest way to get a hundred-pot rack into the app on day one.
              </p>
            ),
          },
          {
            heading: "A collection that does something",
            body: (
              <p>
                An inventory is only useful if it feeds the painting. Owned paints are what{" "}
                <Link href="/paint-recipes" className="text-cyan-lite underline">
                  paint recipes
                </Link>{" "}
                are built from, and recipes attach to the models on your{" "}
                <Link
                  href="/miniature-wargame-project-tracker"
                  className="text-cyan-lite underline"
                >
                  project tracker
                </Link>
                . Track the paints, and the answer to &ldquo;can I paint this tonight with
                what is on the desk?&rdquo; comes for free.
              </p>
            ),
          },
          {
            heading: "What it costs",
            body: (
              <p>
                Browsing the full library and tracking owned and wishlisted paints and
                models is part of the base app — no card needed.{" "}
                <Link href="/pricing" className="text-cyan-lite underline">
                  Sponsoring the Mainframe
                </Link>{" "}
                for $3.99/mo adds the colour toolkit, the Paint Scanner, AI recipe
                generation and army-list auto-build.
              </p>
            ),
          },
        ]}
        related={[
          {
            href: "/miniature-wargame-project-tracker",
            label: "Project tracker",
            blurb: "Armies, units, models and terrain with status, priority and deadlines.",
          },
          {
            href: "/paint-recipes",
            label: "Paint recipes",
            blurb: "Save a colour scheme once, repeat it on the next unit, share it with a link.",
          },
          {
            href: "/gallery",
            label: "Recipe gallery",
            blurb: "Real schemes from other painters — browsable without an account.",
          },
          {
            href: "/pricing",
            label: "Sponsor the Mainframe",
            blurb: "$3.99/mo for the colour toolkit, the Paint Scanner and AI recipes.",
          },
        ]}
        closing={
          <>
            Get your paint collection out of the drawer and into something you can search.
            Free to start, no card needed.
          </>
        }
      />
    </>
  );
}
