"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { AssignToRecipeDialog } from "@/components/recipe/AssignToRecipeDialog";
import { useToast } from "@/components/kit";
import { nearestMatches, similarInOtherBrands } from "@/lib/toolMatch";
import { COLOR_OPTIONS, colorFamilyForHue, filterPaints } from "@/mock/filterPaints";
import { EMPTY_LIBRARY_FILTER, type LibraryFilter, type Paint, type PaintType } from "@/lib/types";
import { loadPaints } from "@/lib/paints/loader";
import { setOwnedCount, toggleWishlistedPaint } from "@/lib/actions/inventory";
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
  const { toast, node } = useToast();
  const [library, setLibrary] = useState<Paint[] | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_LIBRARY_FILTER);
  const [selected, setSelected] = useState<Paint | null>(null);
  const [ownedCount, setOwnedCount_] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [assigning, setAssigning] = useState<Paint | null>(null);
  const [, startTransition] = useTransition();

  /** Patch one paint's flags in the loaded catalog (optimistic). */
  function patchPaint(id: string, fields: Partial<Paint>) {
    setLibrary((lib) =>
      lib ? lib.map((p) => (p.id === id ? { ...p, ...fields } : p)) : lib,
    );
    setSelected((s) => (s && s.id === id ? { ...s, ...fields } : s));
  }

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
  }, [flags, reloadKey]);

  const paints = library ?? [];
  const filtered = useMemo(() => filterPaints(paints, filter), [paints, filter]);
  const brandOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.brand))).sort(),
    [paints],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(paints.map((p) => p.type))).sort(),
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
    setOwnedCount_(p.owned ? 1 : 0);
  }

  function toggleOwned(p: Paint) {
    const nextOwned = !p.owned;
    const count = nextOwned ? 1 : 0;
    patchPaint(p.id, { owned: nextOwned });
    if (selected?.id === p.id) setOwnedCount_(count);
    startTransition(async () => {
      await setOwnedCount({ paintId: p.id, count });
    });
  }

  function toggleWishlist(p: Paint) {
    patchPaint(p.id, { wishlisted: !p.wishlisted });
    startTransition(async () => {
      await toggleWishlistedPaint({ paintId: p.id });
    });
  }

  function stepOwned(delta: number) {
    const next = Math.max(0, ownedCount + delta);
    setOwnedCount_(next);
    if (selected) {
      patchPaint(selected.id, { owned: next > 0 });
      const id = selected.id;
      startTransition(async () => {
        await setOwnedCount({ paintId: id, count: next });
      });
    }
  }

  return (
    <>
    <LibraryView
      paints={filtered}
      totalCount={paints.length}
      filter={filter}
      colorOptions={COLOR_OPTIONS}
      brandOptions={brandOptions}
      typeOptions={typeOptions}
      status={library === null ? "loading" : "ready"}
      selectedPaint={selected}
      ownedCount={ownedCount}
      matchResults={matchResults}
      similar={similar}
      onFilterChange={setFilter}
      onClearFilter={() => setFilter(EMPTY_LIBRARY_FILTER)}
      onOpenPaint={openPaint}
      onClosePaint={() => setSelected(null)}
      onToggleOwned={toggleOwned}
      onToggleWishlist={toggleWishlist}
      onStepOwned={stepOwned}
      onWishlist={() => {
        if (selected) toggleWishlist(selected);
      }}
      onCopyHex={() => {
        if (selected) void navigator.clipboard?.writeText(selected.hex);
      }}
      onAssignPaint={(p) => setAssigning(p)}
      onJumpHue={(hue) =>
        setFilter((f) => ({ ...f, colors: [colorFamilyForHue(hue)] }))
      }
      onRetry={() => {
        setLibrary(null);
        setReloadKey((k) => k + 1);
      }}
    />
    <AssignToRecipeDialog
      open={assigning !== null}
      swatches={
        assigning
          ? [{ hex: assigning.hex, paintId: assigning.id, name: assigning.name }]
          : []
      }
      onClose={() => setAssigning(null)}
      onAssigned={(recipeName) => toast(`Added to ${recipeName}`, "green")}
    />
    {node}
    </>
  );
}
