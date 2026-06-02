/**
 * Per-paint coverage primitives for the Phase-16 heat-sink grid.
 *
 * Pure functions, no React, no DB. Maps the user's `inventory_entry`
 * rows onto the static paint catalog so each square knows its border:
 *
 *   ownedCount > 0            → "owned"   (green border)
 *   isWishlisted && !owned    → "wanted"  (yellow border)
 *   else                      → "none"    (no border)
 *
 * The gap-fill popover (P16.5) reads `nearestPaintsByHue` to suggest
 * "candidate paints to fill this gap" / "you already own a close match".
 */
import type { Paint } from "./types";
import { deltaE2000Hex } from "@/lib/tools/match/deltaE";

export type CoverageState = "owned" | "wanted" | "none";

/** The slice of an inventory row coverage cares about. */
export interface CoverageInventory {
  ownedCount: number;
  isWishlisted: boolean;
}

export type InventoryByPaintId = ReadonlyMap<string, CoverageInventory>;

/**
 * Coverage state for a single paint. Owned beats wanted beats none —
 * a paint the painter owns is "owned" even if it's also flagged
 * wishlisted (e.g. wants a second pot).
 */
export function coverageFor(
  paintId: string,
  inventoryByPaintId: InventoryByPaintId,
): CoverageState {
  const entry = inventoryByPaintId.get(paintId);
  if (!entry) return "none";
  if (entry.ownedCount > 0) return "owned";
  if (entry.isWishlisted) return "wanted";
  return "none";
}

export interface CoverageSummary {
  owned: number;
  wanted: number;
  total: number;
  /** Owned as a 0–100 integer percentage of total. 0 when total is 0. */
  ownedPct: number;
}

/**
 * Roll up coverage across the whole catalog for the header readout
 * ("1,204 / 7,144 owned · 312 wanted"). `total` is the paint count,
 * not the inventory-row count — every catalog paint contributes.
 */
export function coverageSummary(
  paints: readonly Paint[],
  inventoryByPaintId: InventoryByPaintId,
): CoverageSummary {
  let owned = 0;
  let wanted = 0;
  for (const p of paints) {
    const state = coverageFor(p.id, inventoryByPaintId);
    if (state === "owned") owned += 1;
    else if (state === "wanted") wanted += 1;
  }
  const total = paints.length;
  const ownedPct = total === 0 ? 0 : Math.round((owned / total) * 100);
  return { owned, wanted, total, ownedPct };
}

/**
 * The `n` catalog paints closest in colour to `paint`, nearest first,
 * excluding `paint` itself. Ranked by ΔE2000 (the perceptual metric
 * already used across the match/wheel tools) so "near matches" line up
 * with what the painter sees, not just raw hue angle. Unparseable
 * hexes sort to the bottom (ΔE2000Hex returns Infinity for them).
 */
export function nearestPaintsByHue(
  paint: Paint,
  paints: readonly Paint[],
  n: number,
): Paint[] {
  if (n <= 0) return [];
  const ranked = paints
    .filter((p) => p.id !== paint.id)
    .map((p) => ({ p, d: deltaE2000Hex(paint.hex, p.hex) }));
  ranked.sort((a, b) => {
    if (a.d !== b.d) return a.d - b.d;
    // Deterministic tie-break for identical distances.
    return a.p.id.localeCompare(b.p.id);
  });
  return ranked.slice(0, n).map((e) => e.p);
}
