import type { FaqEntry } from "./structuredData";

/**
 * Per-page FAQs for the search-intent landing pages.
 *
 * Each array feeds BOTH that page's `FAQPage` JSON-LD and its visible
 * `<FaqSection />` — the same one-array rule as `HOME_FAQ`, so a marked-up
 * question can never be missing from the page. Kept out of the page files so a
 * node unit test can import and check them without pulling in JSX.
 *
 * Every claim below is true of the shipping app. No counts beyond the paint
 * library's own "7,000+", no user numbers, no ratings.
 */

/** /paint-collection-manager */
export const PAINT_COLLECTION_FAQ: ReadonlyArray<FaqEntry> = [
  {
    q: "How do I track my paint collection?",
    a: "Search the paint library, and mark any paint as owned or wishlisted as you go. Your collection page then lists every pot you own and every one you still want, so you can check the shelf from your phone in a shop instead of guessing.",
  },
  {
    q: "Which paint brands can I track?",
    a: "The library covers 7,000+ paints across brands including Citadel, Vallejo, Army Painter and Scale75, mapped by colour — so a mixed rack of ranges lives in one inventory rather than one list per brand.",
  },
  {
    q: "Can I track miniatures and models too, not just paints?",
    a: "Yes. The collection tracks models and kits alongside paints, with what you paid, so the same page answers both what you own and what the pile cost.",
  },
  {
    q: "Do I have to type every paint in by hand?",
    a: "No. Paints are added straight from the library, and a collection row can fill its own name, brand and price in from a pasted product link on the supported stores. Sponsors can also point the Paint Scanner at a photo of the rack, confirm the matches, and add the lot at once.",
  },
  {
    q: "Is the paint collection manager free?",
    a: "Yes. Browsing the full paint library and tracking owned and wishlisted paints and models is part of the base app, no card needed. Sponsoring the Mainframe for $3.99/mo adds the colour toolkit, the Paint Scanner and AI recipe generation.",
  },
];

/** /miniature-wargame-project-tracker */
export const PROJECT_TRACKER_FAQ: ReadonlyArray<FaqEntry> = [
  {
    q: "What counts as a project?",
    a: "An army, and everything under it — units and warbands, individual models, and terrain. Each one carries its own status, priority, deadline and completion, so a whole force and a single character both live in the same roster.",
  },
  {
    q: "How does it help with the pile of shame?",
    a: "Every unpainted model is on the roster with the stage it is stuck at — built, primed, painted, based, complete — so the backlog stops being a guess. Each project carries a priority and a deadline, so the question of what to paint next gets answered once instead of every time you sit down.",
  },
  {
    q: "Can I track painting sessions?",
    a: "Yes. The Focus bench puts one model's recipe, notes and inspiration on a single screen with a session timer, and the time is logged against the project.",
  },
  {
    q: "Does it work for terrain and non-Warhammer miniatures?",
    a: "Yes. Projects are not tied to any one game or manufacturer — terrain, printed miniatures, historicals and skirmish warbands all track the same way.",
  },
  {
    q: "Is the project tracker free?",
    a: "Yes. Projects, the roster and the Focus bench are part of the base app with no card needed. Sponsoring the Mainframe for $3.99/mo adds the colour toolkit, the Paint Scanner, AI recipe generation and army-list auto-build.",
  },
];

/** /paint-recipes */
export const PAINT_RECIPES_FAQ: ReadonlyArray<FaqEntry> = [
  {
    q: "What is a paint recipe?",
    a: "The colour scheme for a model written down as steps — the paints in order, with the technique tagged on each one, from basecoat through to highlight. Save it once and you can repeat it on the next unit a year later.",
  },
  {
    q: "Can I share a paint recipe?",
    a: "Yes. Every recipe has a share link that anyone can open without an account, and you can publish a recipe to the public gallery.",
  },
  {
    q: "Can I use recipes from other painters?",
    a: "Yes. Browse the gallery signed out, and clone any published scheme into your own recipe library in one click once you have an account. Then swap paints for the ones you actually own.",
  },
  {
    q: "Can I convert a recipe to paints from another brand?",
    a: "Slot by slot, yes. Colour Match ranks the nearest paints across the library's brands for any colour and lets you filter to the brands you actually own, so a Citadel scheme can be rebuilt in Vallejo or Army Painter one paint at a time. There is no one-click whole-recipe conversion. Colour Match is part of the Sponsor toolkit.",
  },
  {
    q: "Can the app write a recipe for me?",
    a: "Sponsors can describe a scheme and get a recipe back, built only from paints that exist in the catalog rather than invented colours. Writing recipes by hand is part of the base app.",
  },
];
