import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  PAINT_COLLECTION_FAQ,
  PAINT_RECIPES_FAQ,
  PROJECT_TRACKER_FAQ,
} from "@/lib/seo/landingFaq";
import { HOME_FAQ, faqPageJsonLd, type FaqEntry } from "@/lib/seo/structuredData";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

/**
 * S1 — the homepage emitted a `FAQPage` block whose questions appeared nowhere
 * in the rendered HTML (verified live 2026-08-21: the only "FAQ" occurrences on
 * `/` were inside the `ld+json` script and its RSC payload copy). That is both
 * ineligible for rich results and against Google's structured-data policy, and
 * it threw away the answers, which are the landing's densest intent copy.
 *
 * The fix is structural: one exported array feeds BOTH the JSON-LD and the
 * visible `<FaqSection />`. These tests hold that line.
 */
describe("FAQ — JSON-LD and the visible section share one array", () => {
  test("faqPageJsonLd() marks up exactly HOME_FAQ, in order", () => {
    const entities = faqPageJsonLd()["mainEntity"] as Array<Record<string, unknown>>;
    expect(entities.map((e) => e["name"])).toEqual(HOME_FAQ.map((f) => f.q));
    expect(
      entities.map((e) => (e["acceptedAnswer"] as Record<string, unknown>)["text"]),
    ).toEqual(HOME_FAQ.map((f) => f.a));
  });

  test("faqPageJsonLd(entries) marks up the array it is handed", () => {
    const entries = [{ q: "Q one", a: "A one" }];
    const entities = faqPageJsonLd(entries)["mainEntity"] as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(1);
    expect(entities[0]!["name"]).toBe("Q one");
  });

  test("HOME_FAQ entries are non-empty question/answer pairs", () => {
    expect(HOME_FAQ.length).toBeGreaterThanOrEqual(3);
    for (const { q, a } of HOME_FAQ) {
      expect(q.trim().length, q).toBeGreaterThan(0);
      expect(a.trim().length, q).toBeGreaterThan(20);
    }
  });

  /**
   * Drift guard: the JSON-LD lives in the route file, the visible copy in the
   * view. Nothing at the type level stops someone rendering a hand-written list
   * next to the marked-up one, so assert the view renders the SAME identifier
   * the route marks up.
   */
  test("LandingView renders <FaqSection items={HOME_FAQ} />", () => {
    const view = read("src/components/public/LandingView.tsx");
    expect(view).toContain('import { HOME_FAQ } from "@/lib/seo/structuredData"');
    expect(view).toContain("<FaqSection items={HOME_FAQ} />");
  });

  test("the homepage route emits faqPageJsonLd() with HOME_FAQ's default", () => {
    const page = read("src/app/(public)/page.tsx");
    expect(page).toContain("faqPageJsonLd()");
  });
});

/**
 * S2–S4 — each SEO landing page marks up its own `FAQPage`. Same rule: the
 * array it hands `faqPageJsonLd()` must be the array it renders.
 */
const LANDING_FAQS: { route: string; ident: string; faq: ReadonlyArray<FaqEntry> }[] = [
  {
    route: "src/app/(public)/paint-collection-manager/page.tsx",
    ident: "PAINT_COLLECTION_FAQ",
    faq: PAINT_COLLECTION_FAQ,
  },
  {
    route: "src/app/(public)/miniature-wargame-project-tracker/page.tsx",
    ident: "PROJECT_TRACKER_FAQ",
    faq: PROJECT_TRACKER_FAQ,
  },
  {
    route: "src/app/(public)/paint-recipes/page.tsx",
    ident: "PAINT_RECIPES_FAQ",
    faq: PAINT_RECIPES_FAQ,
  },
];

describe("SEO landing page FAQs", () => {
  test.each(LANDING_FAQS)("$ident is 3-5 real Q&A pairs", ({ faq }) => {
    expect(faq.length).toBeGreaterThanOrEqual(3);
    expect(faq.length).toBeLessThanOrEqual(5);
    for (const { q, a } of faq) {
      expect(q.trim().endsWith("?"), q).toBe(true);
      expect(a.trim().length, q).toBeGreaterThan(40);
    }
  });

  test.each(LANDING_FAQS)("$route marks up and renders the same array", ({ route, ident }) => {
    const src = read(route);
    expect(src).toContain(`faqPageJsonLd(${ident})`);
    expect(src).toContain(`faq={${ident}}`);
  });

  test.each(LANDING_FAQS)("$route declares its own openGraph + twitter blocks", ({ route }) => {
    // R2-13 — a page with neither falls through to the root layout and unfurls
    // as the generic product page.
    const src = read(route);
    expect(src).toContain("openGraph:");
    expect(src).toContain("twitter:");
    expect(src).toContain("alternates: { canonical:");
  });

  test.each(LANDING_FAQS)("$route emits a breadcrumb trail", ({ route }) => {
    expect(read(route)).toContain("breadcrumbJsonLd(");
  });

  /**
   * Recipe/HowTo is food semantics and a paint scheme is not a dish; a rating
   * with no reviews behind it is a policy violation. Neither may appear.
   */
  test.each(LANDING_FAQS)("$route emits no Recipe/HowTo/rating schema", ({ route }) => {
    const src = read(route);
    for (const banned of ["aggregateRating", '"@type": "Recipe"', "HowTo", "Review"]) {
      expect(src, banned).not.toContain(banned);
    }
  });

  test("no two landing pages share a question", () => {
    const all = LANDING_FAQS.flatMap((s) => s.faq.map((f) => f.q));
    expect(new Set(all).size).toBe(all.length);
  });
});
