import type { Paint } from "@/lib/paints/types";
import type { WishlistItem } from "@/db/schema";

export interface SearchHit<T> {
  item: T;
  score: number;
}

export interface SearchResults {
  paints: SearchHit<Paint>[];
  wishlist: SearchHit<WishlistItem>[];
}

/**
 * Tiny ranker. Substring matches win; otherwise we score by how many
 * tokens of the query appear anywhere in the haystack. Good enough for
 * "find Mephiston Red as I type" without pulling Fuse or MiniSearch.
 */
function score(query: string, hay: string): number {
  const q = query.toLowerCase();
  const h = hay.toLowerCase();
  if (!q) return 0;
  if (h.includes(q)) return 100;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) if (h.includes(t)) hits++;
  return Math.round((hits / tokens.length) * 60);
}

export function runGlobalSearch(
  query: string,
  paints: ReadonlyArray<Paint>,
  wishlist: ReadonlyArray<WishlistItem>,
  limit = 10,
): SearchResults {
  const q = query.trim();
  if (!q) return { paints: [], wishlist: [] };

  const paintHits: SearchHit<Paint>[] = [];
  for (const p of paints) {
    const text = `${p.brand} ${p.line ?? ""} ${p.name} ${p.sku ?? ""}`;
    const s = score(q, text);
    if (s > 0) paintHits.push({ item: p, score: s });
  }
  paintHits.sort((a, b) => b.score - a.score);

  const wishlistHits: SearchHit<WishlistItem>[] = [];
  for (const w of wishlist) {
    const text = `${w.title} ${w.vendor ?? ""}`;
    const s = score(q, text);
    if (s > 0) wishlistHits.push({ item: w, score: s });
  }
  wishlistHits.sort((a, b) => b.score - a.score);

  return {
    paints: paintHits.slice(0, limit),
    wishlist: wishlistHits.slice(0, limit),
  };
}
