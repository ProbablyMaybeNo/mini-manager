"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LibraryView, type LibraryStatus } from "@/components/library/LibraryView";
import { useMockData } from "@/mock/MockProvider";
import { nearestMatches, similarInOtherBrands } from "@/mock/derive";
import { COLOR_OPTIONS, filterPaints } from "@/mock/filterPaints";
import { EMPTY_LIBRARY_FILTER, type LibraryFilter, type Paint } from "@/lib/types";

function LibraryRoute() {
  const data = useMockData();
  const params = useSearchParams();
  const preview = params.get("state"); // loading | error | empty

  const isEmpty = preview === "empty";
  const status: LibraryStatus =
    preview === "loading" ? "loading" : preview === "error" ? "error" : "ready";

  const library = useMemo(() => (isEmpty ? [] : data.paints), [isEmpty, data.paints]);
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_LIBRARY_FILTER);
  const [selected, setSelected] = useState<Paint | null>(null);
  const [ownedCount, setOwnedCount] = useState(0);

  const filtered = useMemo(() => filterPaints(library, filter), [library, filter]);

  const brandOptions = useMemo(
    () => Array.from(new Set(library.map((p) => p.brand))).sort(),
    [library],
  );

  const matchResults = useMemo(
    () => (selected ? nearestMatches(selected, library, 4) : []),
    [selected, library],
  );
  const similar = useMemo(
    () => (selected ? similarInOtherBrands(selected, library, 4) : []),
    [selected, library],
  );

  function openPaint(p: Paint) {
    setSelected(p);
    setOwnedCount(p.owned ? 1 : 0);
  }

  return (
    <LibraryView
      paints={filtered}
      totalCount={isEmpty ? 0 : 7144}
      filter={filter}
      colorOptions={COLOR_OPTIONS}
      brandOptions={brandOptions}
      status={status}
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

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryRoute />
    </Suspense>
  );
}
