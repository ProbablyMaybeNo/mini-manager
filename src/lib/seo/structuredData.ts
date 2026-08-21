import { SITE_URL } from "./site";

/**
 * Structured-data builders (JSON-LD). Deliberately NO Recipe/HowTo schema and
 * NO aggregateRating — there are no real reviews, and food-semantic Recipe
 * schema doesn't fit paint recipes; fabricating ratings violates Google policy.
 */

/** WebApplication describing the product for rich results eligibility. */
export function webApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "The Mini Mainframe",
    url: SITE_URL,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web browser",
    description:
      "Miniature painting tracker, paint collection manager, and wargame project tracker — 7,000+ paints across Citadel, Vallejo and Army Painter, colour tools, and shareable paint recipes.",
    offers: {
      "@type": "Offer",
      price: "3.99",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "3.99",
        priceCurrency: "USD",
        billingIncrement: 1,
        unitCode: "MON",
      },
    },
  };
}

/** One question/answer pair. The SAME array feeds the `FAQPage` JSON-LD and
 *  the visible FAQ section, so the two can never drift — Google requires the
 *  marked-up Q&A to be present on the page as content. */
export type FaqEntry = { q: string; a: string };

/** Homepage FAQ — the answers double as visible-intent keyword copy. Every
 *  claim here is true of the shipping app. Rendered visibly by
 *  `<FaqSection items={HOME_FAQ} />` in `LandingView`. */
export const HOME_FAQ: ReadonlyArray<FaqEntry> = [
  {
    q: "What is The Mini Mainframe?",
    a: "A miniature painting tracker and paint collection manager for wargamers. Track every model from wishlist to finished, save cross-brand paint recipes, and manage your Warhammer, Citadel, Vallejo and Army Painter paints in one place.",
  },
  {
    q: "Does The Mini Mainframe cost anything?",
    a: "You can sign up and start tracking projects, browsing the paint library, and building recipes at no cost. Sponsoring the Mainframe for $3.99/mo unlocks the full colour toolkit, the Paint Scanner, and AI recipe generation.",
  },
  {
    q: "Which paint brands does it support?",
    a: "The paint library covers 7,000+ paints across brands including Citadel, Vallejo, Army Painter and Scale75, so you can build a recipe from what you own and match a colour to the nearest paint in another range.",
  },
  {
    q: "Can it help me clear my pile of shame?",
    a: "Yes — the wargame project tracker and hobby backlog view surface every unpainted model and its stage, so you can chip away at the pile of shame one unit at a time.",
  },
  {
    q: "What can I do with paint recipes?",
    a: "Save a colour scheme once, then reuse or share it. Browse community recipes in the gallery and clone any scheme to your own library in one click.",
  },
];

/** FAQPage built from a Q&A array — the homepage's by default. Callers pass
 *  their own page FAQ and render the same array through `<FaqSection />`. */
export function faqPageJsonLd(
  entries: ReadonlyArray<FaqEntry> = HOME_FAQ,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** BreadcrumbList from a Home → … trail of { name, path } crumbs. */
export function breadcrumbJsonLd(
  crumbs: ReadonlyArray<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}
