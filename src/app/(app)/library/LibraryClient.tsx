"use client";

import { useEffect, useMemo, useState } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { nearestMatches, similarInOtherBrands } from "@/mock/derive";
import { COLOR_OPTIONS, filterPaints } from "@/mock/filterPaints";
import { EMPTY_LIBRARY_FILTER, type LibraryFilter, type Paint, type PaintType } from "@/lib/types";
import { loadPaints } from "@/lib/paints/loader";
import type { InventoryFlags } from "@/lib/appData";

/** Catalog paint type → kit PaintType (the kit chip set is narrower). */
const PAINT_TYPE_MAP: Record<string, PaintType> = {
  Paint: "Acrylic",
  Wash: "Wash",
  Metallic: "Acrylic",
  Contrast: "Contrast",
  Air: "Acrylic",
  Primer: "Primer",
  Varnish: "Clear",
  Pigment: "Texture",
  Effect: "Texture",
  Ink: "Wash",
  Lacquer: "Clear",
};

/**
 * Library route controller. Loads the real catalog client-side (the static
 * /data/paints.json, IndexedDB-cached) and merges the server-supplied
 * owned/wishlisted flags onto it, then drives the kit's LibraryView. Inventory
 * mutations are wired in a later phase; browse / filter / inspect is live.
 */
export function LibraryClient({ flags }: { flags: InventoryFlags }) {
  const [library, setLibrary] = useState<Paint[] | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_LIBRARY_FILTER);
  const [selected, setSelected] = useState<Paint | null>(null);
  const [ownedCount, setOwnedCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const owned = new Set(flags.ownedIds);
    const wishlisted = new Set(flags.wishlistedIds);
    loadPaints()
      .then((catalog) => {
        if (!alive) return;
        setLibrary(
          catalog.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            line: p.line ?? "",
            hex: p.hex,
            type: PAINT_TYPE_MAP[p.type] ?? "Acrylic",
            sku: p.sku ?? "",
            owned: owned.has(p.id),
            wishlisted: wishlisted.has(p.id),
          })),
        );
      })
      .catch(() => {
        if (alive) setLibrary([]);
      });
    return () => {
      alive = false;
    };
  }, [flags]);

  const paints = library ?? [];
  const filtered = useMemo(() => filterPaints(paints, filter), [paints, filter]);
  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  const matchResults = useMemo(
    () => (selected ? nearestMatches(selected, paints, 4) : []),
    [selected, paints],
  );
  const similar = useMemo(
    () => (selected ? similarInOtherBrands(selected, paints, 4) : []),
    [selected, paints],
  );

  function openPaint(p: Paint) {
    setSelected(p);
    setOwnedCount(p.owned ? 1 : 0);
  }

  return (
    <LibraryView
      paints={filtered}
      totalCount={paints.length}
      filter={filter}
      colorOptions={COLOR_OPTIONS}
      brandOptions={brandOptions}
      status={library === null ? "loading" : "ready"}
      selectedPaint={selected}
      ownedCount={ownedCount}
      matchResults={matchResults}
      similar={similar}
      onFilterChange={setFilter}
      onClearFilter={() => setFilter(EMPTY_LIBRARY_FILTER)}
      onOpenPaint={openPaint}
      onClosePaint={() => setSelected(null)}
      onToggleOwned={() => {}}
      onToggleWishlist={() => {}}
      onStepOwned={(d) => setOwnedCount((c) => Math.max(0, c + d))}
      onWishlist={() => {}}
      onCopyHex={() => {
        if (selected) void navigator.clipboard?.writeText(selected.hex);
      }}
      onAssignPaint={() => {}}
      onJumpHue={() => {}}
      onRetry={() => {}}
    />
  );
}
