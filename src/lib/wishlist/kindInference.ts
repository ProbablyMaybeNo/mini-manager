/**
 * P12.11 — Infer wishlist item kind ('paint' | 'model') from the
 * scraped title, vendor, and category fields.
 *
 * Same heuristic the migration SQL applies as a one-shot backfill:
 * any title that looks like a kit / box / army / squad / warband /
 * unit / terrain / tank / character → 'model'. Vendors known to sell
 * mostly miniatures + categories already labelled Box / Terrain also
 * nudge towards 'model'. Everything else → 'paint' (the default,
 * because most wishlist additions come from the Match tool's "add
 * paint to wishlist" flow).
 *
 * Pure helper, no I/O. Same shape used by the migration so changing
 * the rules here ripples to both back-compat data + new scraping
 * decisions.
 */

import type { WishlistKind } from "@/db/schema";

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

const MODEL_VENDORS = new Set<string>([
  "Element Games",
  "Wayland Games",
  "Goblin Gaming",
]);

const MODEL_CATEGORIES = new Set<string>(["Box", "Terrain"]);

export interface InferKindInput {
  title: string;
  vendor?: string | null;
  category?: string | null;
}

export function inferWishlistKind(input: InferKindInput): WishlistKind {
  const lc = input.title.toLowerCase();
  for (const term of MODEL_TITLE_TERMS) {
    if (lc.includes(term)) return "model";
  }
  if (input.vendor && MODEL_VENDORS.has(input.vendor)) return "model";
  if (input.category && MODEL_CATEGORIES.has(input.category)) return "model";
  return "paint";
}
