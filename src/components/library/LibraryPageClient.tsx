"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import type { Paint } from "@/lib/paints/types";
import { applyAllFilters } from "@/lib/paints/filters";
import { sortPaints } from "@/lib/paints/sort";
import {
  filterFromSearchParams,
  sortFromSearchParams,
  selectedPaintFromSearchParams,
} from "@/lib/paints/filterUrl";
import { FilterRail } from "./FilterRail";
import { LibraryTable } from "./LibraryTable";
import { PaintDetailPanel } from "./PaintDetailPanel";

/**
 * Client wrapper that owns the interactive parts of the library page.
 * Keeps the page component (server) thin — just data fetch + a single
 * client island.
 */
export function LibraryPageClient({ paints }: { paints: ReadonlyArray<Paint> }) {
  const sp = useSearchParams();

  // The URLSearchParams shape Next provides is read-only but compatible
  // with the helper functions below.
  const filter = useMemo(() => filterFromSearchParams(sp), [sp]);
  const sortMode = useMemo(() => sortFromSearchParams(sp), [sp]);
  const selectedId = useMemo(() => selectedPaintFromSearchParams(sp), [sp]);

  // Inventory lookups land in P2.3 — pass an empty map for now so the
  // table renders the placeholder owned/wishlist glyphs.
  const inventory = useMemo(
    () => new Map<string, { ownedCount: number; isWishlisted: boolean }>(),
    [],
  );
  const ownedCounts = useMemo(() => {
    const out = new Map<string, number>();
    inventory.forEach((v, k) => out.set(k, v.ownedCount));
    return out;
  }, [inventory]);

  const filtered = useMemo(
    () => sortPaints(applyAllFilters([...paints], filter, ownedCounts), sortMode),
    [paints, filter, ownedCounts, sortMode],
  );

  const selected = useMemo(
    () => (selectedId ? paints.find((p) => p.id === selectedId) ?? null : null),
    [paints, selectedId],
  );

  const similar = useMemo(
    () => (selected ? findSimilar(selected, [...paints]) : []),
    [selected, paints],
  );

  return (
    <div className="flex flex-1 min-h-0">
      <FilterRail paints={paints} filter={filter} ownedOnlyDisabled />
      <LibraryTable
        paints={filtered}
        selectedPaintId={selectedId}
        inventoryByPaint={inventory}
      />
      <PaintDetailPanel paint={selected} similarInOtherBrands={similar} />
    </div>
  );
}

/**
 * Cheap "similar in other brands" — sort by RGB distance and keep the
 * top 5 that are NOT from the same brand. The Tools/Match page in Phase
 * 4 will replace this with a proper ΔE2000 ranker.
 */
function findSimilar(target: Paint, all: Paint[]): Paint[] {
  const t = parseHex(target.hex);
  if (!t) return [];
  const scored: Array<{ p: Paint; d: number }> = [];
  for (const p of all) {
    if (p.brand === target.brand) continue;
    const rgb = parseHex(p.hex);
    if (!rgb) continue;
    const d =
      (rgb[0] - t[0]) * (rgb[0] - t[0]) +
      (rgb[1] - t[1]) * (rgb[1] - t[1]) +
      (rgb[2] - t[2]) * (rgb[2] - t[2]);
    scored.push({ p, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, 5).map((x) => x.p);
}

function parseHex(hex: string): [number, number, number] | null {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  if (s.length !== 6) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}
