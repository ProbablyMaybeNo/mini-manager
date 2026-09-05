/**
 * Infer wishlist item kind ('paint' | 'model') from the scraped title,
 * vendor, and category.
 *
 * Signals are checked STRONGEST FIRST — this ordering is the whole point of
 * the function, and getting it wrong is what made every paint bought from
 * Element Games or Wayland land in the model collection (Ross, 2026-09-05,
 * hit repeatedly through the browser extension):
 *
 *   1. `category` — the store's OWN taxonomy, read off the product URL by
 *      `inferCategoryFromUrl`. Real evidence about this specific item.
 *   2. Paint words in the title — "paint", "wash", "primer", …
 *   3. Model words in the title — "squad", "kit", "tank", …
 *   4. `vendor` — a PRIOR, not evidence: "this shop mostly sells miniatures".
 *      Only reachable when nothing above said anything.
 *
 * The bug was that (4) ran before (1), so a weak prior about a *shop*
 * overruled a strong fact about the *product*. A Citadel paint from Element
 * Games arrived with `category: "Paint"` and was still filed as a model. The
 * old behaviour was deliberate — the previous tests asserted vendor won "even
 * on a paint-sounding title" — but it was written before the parsers reliably
 * emitted a category, when vendor was the best signal available. It no longer
 * is.
 *
 * Title matching is word-boundary, not substring. "The Army Painter" is a
 * PAINT BRAND whose name contains "army"; under substring matching every one
 * of its products was a model, from any vendor. Checking paint words before
 * model words settles that case on "painter" rather than "army".
 *
 * `Tool` (brushes, clippers) is deliberately not mapped: it is neither a paint
 * nor a model, and `kind` has no third value, so it falls through to the
 * 'paint' default exactly as before. A real fix needs a schema change.
 *
 * Pure helper, no I/O.
 *
 * NOTE ON THE MIGRATION: this heuristic was once kept in lockstep with the
 * one-shot backfill in `0007_wishlist_phase12_rename.sql`. That migration has
 * long since run and is a historical artifact — it is NOT re-run, and this
 * function deliberately no longer matches it. Rows written under the old rules
 * keep the old (sometimes wrong) kind until something re-classifies them.
 */

import type { WishlistKind } from "@/db/schema";

/** Categories that settle it outright, from `ScrapedCategory`. */
const PAINT_CATEGORIES = new Set<string>(["Paint"]);
const MODEL_CATEGORIES = new Set<string>(["Box", "Terrain", "Bits"]);

/** Checked BEFORE the model terms — see the "Army Painter" note above. */
const PAINT_TITLE_TERMS = [
  "paint",
  "wash",
  "primer",
  "varnish",
  "contrast",
  "thinner",
  "ink",
] as const;

const MODEL_TITLE_TERMS = [
  "squad",
  "warband",
  "army",
  "unit",
  "kit",
  "box",
  "terrain",
  "tank",
  "character",
] as const;

/**
 * Vendors that sell mostly miniatures. A tiebreaker of last resort, applied
 * only when the category and the title are both silent.
 */
const MODEL_VENDORS = new Set<string>([
  "Element Games",
  "Wayland Games",
  "Goblin Gaming",
]);

/**
 * Whole-word match, so "army" hits "Necron Army" but not "The Army Painter"'s
 * neighbouring words, and "box" hits "Boxset" only via its own stem rather
 * than matching inside unrelated words like "Boxer".
 */
function hasWord(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => new RegExp(`\\b${term}`, "i").test(haystack));
}

export interface InferKindInput {
  title: string;
  vendor?: string | null;
  category?: string | null;
}

export function inferWishlistKind(input: InferKindInput): WishlistKind {
  // 1. The store's own classification of this exact product.
  if (input.category) {
    if (PAINT_CATEGORIES.has(input.category)) return "paint";
    if (MODEL_CATEGORIES.has(input.category)) return "model";
  }

  // 2 + 3. What the product calls itself. Paint first, so a paint brand whose
  // name contains a model word resolves as a paint.
  const title = input.title;
  if (hasWord(title, PAINT_TITLE_TERMS)) return "paint";
  if (hasWord(title, MODEL_TITLE_TERMS)) return "model";

  // 4. Nothing said anything — fall back to what this shop mostly sells.
  if (input.vendor && MODEL_VENDORS.has(input.vendor)) return "model";

  return "paint";
}
