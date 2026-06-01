/**
 * R7-004 — resolve a free-text paint title (e.g. "Mephiston Red") to a
 * Paint row in the loaded catalog. Used by the Wheel tool's `?name=`
 * deep-link fallback (Wishlist "Tools ▾ → Wheel" sends `?name=` since
 * the wishlist row only knows the title; the wheel side resolves that
 * to a hex via catalog lookup).
 *
 * Pure function — kept out of the WheelClient `'use client'` module so
 * the unit tests can import it without dragging React + Next router
 * deps into a Node test environment.
 */
import type { Paint } from "@/lib/paints/types";

/**
 * Match priority:
 *   1. Exact case-insensitive name match
 *   2. Concatenated "Brand Name" exact match
 *   3. Case-insensitive substring on name
 * Returns null when nothing usable matches — the wheel stays on the
 * red default.
 */
export function resolvePaintByName(
  paints: ReadonlyArray<Paint>,
  rawTitle: string,
): Paint | null {
  const q = rawTitle.trim().toLowerCase();
  if (!q) return null;
  const byExactName = paints.find((p) => p.name.toLowerCase() === q);
  if (byExactName) return byExactName;
  const byBrandedExact = paints.find(
    (p) => `${p.brand} ${p.name}`.toLowerCase() === q,
  );
  if (byBrandedExact) return byBrandedExact;
  const byNameSubstr = paints.find((p) => p.name.toLowerCase().includes(q));
  if (byNameSubstr) return byNameSubstr;
  return null;
}
