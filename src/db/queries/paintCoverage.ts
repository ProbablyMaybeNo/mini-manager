import "server-only";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inventoryEntries } from "@/db/schema";
import type { Paint, PaintCatalog } from "@/lib/paints/types";
import {
  coverageFor,
  coverageSummary,
  type CoverageInventory,
  type CoverageState,
  type CoverageSummary,
  type InventoryByPaintId,
} from "@/lib/paints/coverage";
import { hueSortedPaintIndex } from "@/lib/paints/hue";

/**
 * P16.2 — server read layer for the heat-sink coverage grid.
 *
 * Two responsibilities:
 *   - `getInventoryByPaintId` — a single indexed read of the painter's
 *     `inventory_entry` rows, projected to the slim
 *     `{ ownedCount, isWishlisted }` shape coverage cares about, keyed
 *     by paintId. Rides the `inventory_owner_idx` BTree.
 *   - `getCoverageGrid` — composes the hue-sorted catalog with that
 *     inventory map into the per-cell coverage states + header summary
 *     the cell renderer (P16.3) consumes. The join lives here, not in a
 *     component, so it's testable in isolation.
 */

/**
 * The painter's inventory, projected to what coverage needs and keyed
 * by paintId for O(1) per-cell lookups. Paints the painter has never
 * touched simply aren't in the map (→ "none").
 */
export async function getInventoryByPaintId(
  userId: string,
): Promise<Map<string, CoverageInventory>> {
  const rows = await db
    .select({
      paintId: inventoryEntries.paintId,
      ownedCount: inventoryEntries.ownedCount,
      isWishlisted: inventoryEntries.isWishlisted,
    })
    .from(inventoryEntries)
    .where(eq(inventoryEntries.ownerId, userId));

  const out = new Map<string, CoverageInventory>();
  for (const row of rows) {
    out.set(row.paintId, {
      ownedCount: row.ownedCount,
      isWishlisted: row.isWishlisted,
    });
  }
  return out;
}

/** One hue-sorted grid cell: the paint plus its coverage border state. */
export interface CoverageCell {
  paint: Paint;
  state: CoverageState;
}

/** Everything the grid renders: ordered cells + the header readout. */
export interface CoverageGrid {
  cells: CoverageCell[];
  summary: CoverageSummary;
}

/**
 * Pure join: hue-sorted paints × inventory → ordered coverage cells +
 * summary. Exported separately from the DB-bound reader so it can be
 * unit-tested against any paint array without touching disk or the DB.
 */
export function composeCoverageGrid(
  paints: readonly Paint[],
  inventoryByPaintId: InventoryByPaintId,
): CoverageGrid {
  const sorted = hueSortedPaintIndex(paints);
  const cells = sorted.map((paint): CoverageCell => ({
    paint,
    state: coverageFor(paint.id, inventoryByPaintId),
  }));
  const summary = coverageSummary(paints, inventoryByPaintId);
  return { cells, summary };
}

/* ============================================================
   Catalog loader — server-side, cached per export timestamp.
   Mirrors getPaintMetaMap in queries/recipes.ts.
   ============================================================ */

let catalogCache: Paint[] | null = null;
let catalogCacheExportedAt = -1;

/**
 * Read the static paint catalog from disk. Cached per export timestamp
 * so the read + JSON parse is paid once per process.
 */
export async function loadCatalogPaints(): Promise<Paint[]> {
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const raw = await readFile(file, "utf8");
  const catalog = JSON.parse(raw) as PaintCatalog;
  if (catalogCache && catalogCacheExportedAt === catalog.__exported_at) {
    return catalogCache;
  }
  catalogCache = catalog.paints;
  catalogCacheExportedAt = catalog.__exported_at;
  return catalog.paints;
}

/**
 * Top-level server read the PLANNER grid mounts: load the catalog,
 * read the painter's inventory, and compose the two. The cell renderer
 * just maps over `grid.cells` — no joining in the component.
 */
export async function getCoverageGrid(userId: string): Promise<CoverageGrid> {
  const [paints, inventory] = await Promise.all([
    loadCatalogPaints(),
    getInventoryByPaintId(userId),
  ]);
  return composeCoverageGrid(paints, inventory);
}
