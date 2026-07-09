/**
 * LAYERING "MATCH" button — ground a derived-lane hex to a real catalog
 * paint. Reuses the app's own ΔE2000 ranking (`closestPaint`) and the
 * picker's "could pass as the same colour" threshold (`MATCH_DEFAULT_DELTAE`)
 * rather than inventing a new distance cutoff.
 */

import { closestPaint } from "@/lib/toolMatch";
import { MATCH_DEFAULT_DELTAE } from "@/lib/colorPicker/matchPaints";
import { deltaE2000Hex } from "@/lib/tools/match/deltaE";
import type { Paint } from "@/lib/types";

/**
 * Default: closest paint across the WHOLE catalog by ΔE2000 — the ideal
 * shade/highlight, regardless of ownership.
 *
 * `ownedFirst`: prefer the closest paint the painter OWNS, but only when
 * it's a reasonable match (ΔE2000 ≤ {@link MATCH_DEFAULT_DELTAE}, the same
 * threshold the ColorPicker's Library match uses for "close enough to read
 * as the same colour"). Falls back to the catalog-wide closest paint when
 * no owned paint clears that bar (or the painter owns nothing), so a lane
 * never grounds to an owned paint that looks nothing like the derived hex.
 */
export function groundLane(
  hex: string,
  pool: Paint[],
  ownedIds: ReadonlySet<string>,
  ownedFirst: boolean,
): Paint | null {
  if (ownedFirst && ownedIds.size > 0) {
    const owned = pool.filter((p) => ownedIds.has(p.id));
    const closestOwned = closestPaint(hex, owned);
    if (closestOwned && deltaE2000Hex(hex, closestOwned.hex) <= MATCH_DEFAULT_DELTAE) {
      return closestOwned;
    }
  }
  return closestPaint(hex, pool);
}
