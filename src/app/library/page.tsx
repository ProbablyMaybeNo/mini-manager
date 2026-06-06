import "server-only";

import { Suspense } from "react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";

import type { PaintCatalog } from "@/lib/paints/types";
import {
  LibraryPageClient,
  type InventorySnapshot,
} from "@/components/library/LibraryPageClient";
import { listInventoryByUser } from "@/db/queries/inventory";
import { currentUserId } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { decodeLibraryBrandFilter } from "@/lib/libraryBrandFilter/decode";
import { composeCoverageGrid } from "@/db/queries/paintCoverage";
import type { InventoryByPaintId } from "@/lib/paints/coverage";

export const dynamic = "force-dynamic";

/**
 * Load the static paint catalog from disk on the server. We avoid `fetch`
 * because Next 16 / dev mode doesn't always have a localhost URL available
 * to the server when rendering — and the file lives in `public/` so a
 * direct read is faster anyway.
 */
async function loadPaintCatalog(): Promise<PaintCatalog> {
  const file = resolve(process.cwd(), "public", "data", "paints.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as PaintCatalog;
}

export default async function LibraryPage() {
  const userId = await currentUserId();
  const [catalog, inventoryEntries, userRow] = await Promise.all([
    loadPaintCatalog(),
    listInventoryByUser(userId),
    db
      .select({ libraryBrandFilter: users.libraryBrandFilter })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);
  // P12.19 — saved brand filter. null = "no filter". Library client
  // applies this only when the URL doesn't already carry a brand list.
  const defaultBrands = decodeLibraryBrandFilter(
    userRow[0]?.libraryBrandFilter ?? null,
  );

  // Trim the DB row down to what the client actually needs.
  const inventory = new Map<string, InventorySnapshot>();
  inventoryEntries.forEach((entry, paintId) => {
    inventory.set(paintId, {
      ownedCount: entry.ownedCount,
      isWishlisted: entry.isWishlisted,
    });
  });

  // LIB-COLORMAP — compose the hue-sorted coverage cells for the library's
  // right-hand colour map. The InventoryByPaintId map shares the
  // {ownedCount, isWishlisted} shape with `inventory`, so we reuse it.
  const inventoryByPaintId: InventoryByPaintId = inventory;
  const { cells: coverageCells, summary: coverageSummary } = composeCoverageGrid(
    catalog.paints,
    inventoryByPaintId,
  );
  // Distinct catalog brands, sorted — the map's brand-chip row.
  const brands = Array.from(
    new Set(catalog.paints.map((p) => p.brand)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem-5rem)] md:h-screen">
      {/* Terminal hero — mirrors the dashboard banner so the Library reads
          as the same mission-control surface: a tracked-out coordinate
          caption above the display-font title, not a plain SaaS H1. */}
      <header className="relative overflow-hidden px-4 md:px-8 pt-4 md:pt-6 pb-3 md:pb-4 border-b border-[var(--color-border)]">
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
          SYS ▸ CATALOG / 02
        </p>
        <h1 className="title-display text-base md:text-lg">LIBRARY</h1>
        <p className="text-xs text-[var(--color-fg-muted)] mt-3 font-sans pr-24 md:pr-0">
          {catalog.__row_count.toLocaleString()} paints across the cross-brand catalog.
          Filter by brand, line, type, or hue. Tap a row for swatch detail.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="p-8 text-sm font-mono text-[var(--color-fg-muted)]">
            Loading paint catalog…
          </div>
        }
      >
        <LibraryPageClient
          paints={catalog.paints}
          inventory={inventory}
          defaultBrands={defaultBrands ?? undefined}
          coverageCells={coverageCells}
          coverageSummary={coverageSummary}
          brands={brands}
        />
      </Suspense>
    </div>
  );
}
