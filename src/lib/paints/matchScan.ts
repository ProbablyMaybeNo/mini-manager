/**
 * Fuzzy-match vision-read paint labels against the paint catalog.
 *
 * Pure, dependency-free — no DB/fs/network — so it's the same code path in
 * the server action and in unit tests with zero mocking. Given a
 * `{brand, name}` pair read off a photographed label (which may have OCR-ish
 * noise: minor misspellings, brand shorthand, word reordering), find the
 * best catalog `Paint` match plus a short list of plausible alternates so
 * the confirm UI can offer a manual swap.
 *
 * Strategy (per the feature spec): prefer a brand-scoped match — any
 * catalog row whose brand plausibly corresponds to the read brand (handles
 * "Army Painter" -> "The Army Painter", "Vallejo" -> any of its four
 * product lines, minor brand typos) — and require a lower name-similarity
 * bar within that scope than when falling back to a cross-brand search.
 */
import type { Paint } from "./types";

export interface ExtractedPaintLabel {
  brand: string;
  name: string;
}

export interface PaintScanMatch {
  extracted: ExtractedPaintLabel;
  /** The best catalog match, or null when nothing scored confidently
   *  enough to auto-select — the confirm UI still offers `alternates`. */
  match: Paint | null;
  /** Other plausible candidates, best first, for the confirm UI's swap
   *  control. Never includes `match` itself. */
  alternates: Paint[];
}

/** Name-similarity bar to auto-accept within a brand-scoped candidate pool. */
const WITHIN_BRAND_ACCEPT = 0.55;
/** Higher bar when brand can't corroborate the match (cross-brand fallback). */
const CROSS_BRAND_ACCEPT = 0.68;
const ALTERNATES_LIMIT = 5;

/** lowercase, strip accents/punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (curr[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

/**
 * 0..1 similarity blending edit-distance ratio (typo tolerance) with token
 * (word) overlap — the latter keeps "Red Mephiston" ~ "Mephiston Red" and
 * partial-label reads reasonably close despite a large edit distance.
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const levSim = maxLen === 0 ? 1 : 1 - levenshtein(na, nb) / maxLen;
  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const overlap = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const tokenSim = union === 0 ? 0 : overlap / union;
  return levSim * 0.5 + tokenSim * 0.5;
}

/** Does the catalog brand plausibly correspond to the read brand? Exact
 *  match, substring either direction (handles "Army Painter" <->
 *  "The Army Painter", "Vallejo" <-> "Vallejo Model Color"), or a close
 *  typo-tolerant match. */
function brandRelated(extractedBrand: string, catalogBrand: string): boolean {
  const q = normalize(extractedBrand);
  const c = normalize(catalogBrand);
  if (!q || !c) return false;
  if (q === c || c.includes(q) || q.includes(c)) return true;
  return similarity(q, c) >= 0.8;
}

function rankByName(
  extracted: ExtractedPaintLabel,
  pool: readonly Paint[],
): { paint: Paint; score: number }[] {
  return pool
    .map((paint) => ({ paint, score: similarity(extracted.name, paint.name) }))
    .sort((a, b) => b.score - a.score);
}

/** Match one extracted `{brand, name}` against the catalog. */
export function matchExtractedPaint(
  extracted: ExtractedPaintLabel,
  catalog: readonly Paint[],
): PaintScanMatch {
  const brandScoped = catalog.filter((p) => brandRelated(extracted.brand, p.brand));
  const inScope = brandScoped.length > 0;
  const pool = inScope ? brandScoped : catalog;
  const threshold = inScope ? WITHIN_BRAND_ACCEPT : CROSS_BRAND_ACCEPT;

  const ranked = rankByName(extracted, pool);
  const best = ranked[0];

  if (best && best.score >= threshold) {
    const alternates = ranked
      .slice(1, 1 + ALTERNATES_LIMIT)
      .filter((r) => r.score > 0)
      .map((r) => r.paint);
    return { extracted, match: best.paint, alternates };
  }

  // No confident match in the brand-scoped pool — widen to the full catalog
  // (if we hadn't already) so the confirm UI can still offer plausible
  // manual-swap candidates.
  const fullRanked = inScope ? rankByName(extracted, catalog) : ranked;
  const alternates = fullRanked
    .slice(0, ALTERNATES_LIMIT)
    .filter((r) => r.score > 0)
    .map((r) => r.paint);
  return { extracted, match: null, alternates };
}

/** Batch form — one match result per extracted label, catalog loaded once. */
export function matchScannedPaints(
  extracted: readonly ExtractedPaintLabel[],
  catalog: readonly Paint[],
): PaintScanMatch[] {
  return extracted.map((e) => matchExtractedPaint(e, catalog));
}
