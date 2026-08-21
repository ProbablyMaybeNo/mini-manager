import type { Metadata } from "next";
import Link from "next/link";
import { SeoLandingLayout } from "@/components/public/SeoLandingLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { PROJECT_TRACKER_FAQ } from "@/lib/seo/landingFaq";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/structuredData";

const OG_TITLE = "Miniature Wargame Project Tracker · The Mini Mainframe";
const OG_DESCRIPTION =
  "Track armies, units, models and terrain with status, priority, deadlines and completion — a hobby backlog tracker that turns the pile of shame into a list you can actually clear.";

export const metadata: Metadata = {
  title: OG_TITLE,
  description:
    "A miniature wargame project tracker for armies, units, models and terrain. Every project carries a status, a priority, a deadline and a completion percentage, so your hobby backlog stops being a pile of shame and starts being a queue. Free to start.",
  alternates: { canonical: "/miniature-wargame-project-tracker" },
  // R2-13 — its own openGraph + twitter blocks, or a shared link unfurls as
  // the generic product page. The image is inherited from
  // (public)/opengraph-image.tsx and is correct.
  openGraph: { title: OG_TITLE, description: OG_DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image", title: OG_TITLE, description: OG_DESCRIPTION },
};

export default function MiniatureWargameProjectTrackerPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          {
            name: "Miniature Wargame Project Tracker",
            path: "/miniature-wargame-project-tracker",
          },
        ])}
      />
      <JsonLd data={faqPageJsonLd(PROJECT_TRACKER_FAQ)} />
      <SeoLandingLayout
        title="Miniature Wargame Project Tracker"
        ctaLocation="miniature-wargame-project-tracker"
        faq={PROJECT_TRACKER_FAQ}
        faqHeading="Backlog questions"
        lede={
          <>
            The Mini Mainframe is a miniature wargame project tracker. Armies, units,
            models and terrain go on one roster with a status, a priority, a deadline and a
            completion figure — so the hobby backlog stops being a shelf you avoid looking
            at and becomes a queue you can work through.
          </>
        }
        sections={[
          {
            heading: "Your army, as a tree",
            body: (
              <>
                <p>
                  A project can be an army, a warband, a unit, a single model, a terrain
                  piece or a diorama, and projects nest — an army holds its units, a unit
                  holds its models. That means a 2,000-point force and the one character
                  you are painting tonight both live in the same roster, at the level of
                  detail each deserves.
                </p>
                <p>
                  Each project carries a faction, a game, a points value and notes, so the
                  roster reads like your hobby rather than a generic task list.
                </p>
              </>
            ),
          },
          {
            heading: "A pile of shame tracker that actually counts",
            body: (
              <>
                <p>
                  Progress is not a guess or a slider you drag. Every project counts models
                  through five real stages — built, primed, painted, based, completed — and
                  the completion percentage falls out of those counters and rolls up to the
                  army above. Half-finished units read as half finished.
                </p>
                <p>
                  That is what makes a hobby backlog tracker useful: you can see that the
                  reason the army is stuck is thirty models sitting at &ldquo;primed&rdquo;,
                  not a vague feeling that there is a lot left.
                </p>
              </>
            ),
          },
          {
            heading: "Decide once what to paint next",
            body: (
              <p>
                Status, priority and a target date on every project mean the &ldquo;what
                should I paint next&rdquo; question gets answered once instead of every
                time you sit down. A tournament date goes on the calendar, the units that
                have to be table-ready before it get the priority, and the roster tells you
                where you are against it.
              </p>
            ),
          },
          {
            heading: "Then actually sit down and paint",
            body: (
              <p>
                Pin a model to the Focus bench and you get its{" "}
                <Link href="/paint-recipes" className="text-cyan-lite underline">
                  paint recipe
                </Link>
                , its notes, its reference images and a session timer on one screen. Log
                the session and the minutes go against the project, alongside a running
                streak — so the tracker records what you did, not only what is left.
              </p>
            ),
          },
          {
            heading: "Terrain, printed minis and every other system",
            body: (
              <p>
                Nothing here is tied to one manufacturer or one rulebook. Terrain pieces,
                printed miniatures, historicals, skirmish warbands and board-game inserts
                all track the same way, and the paints behind them come from a cross-brand{" "}
                <Link href="/paint-collection-manager" className="text-cyan-lite underline">
                  paint collection
                </Link>{" "}
                rather than a single range.
              </p>
            ),
          },
          {
            heading: "What it costs",
            body: (
              <p>
                Projects, the roster and the Focus bench are part of the base app — no card
                needed.{" "}
                <Link href="/pricing" className="text-cyan-lite underline">
                  Sponsoring the Mainframe
                </Link>{" "}
                for $3.99/mo adds army-list auto-build, which turns a pasted or uploaded
                army list into the whole project tree, plus the colour toolkit, the Paint
                Scanner and AI recipe generation.
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
            blurb: "$3.99/mo for army-list auto-build, the colour toolkit and AI recipes.",
          },
        ]}
        closing={
          <>
            Put the pile on a roster and it stops being a pile. Free to start, no card
            needed.
          </>
        }
      />
    </>
  );
}
