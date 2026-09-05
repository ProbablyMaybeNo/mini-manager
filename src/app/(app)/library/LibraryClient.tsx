"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LibraryView } from "@/components/library/LibraryView";
import { AssignToRecipeDialog } from "@/components/recipe/AssignToRecipeDialog";
import { useToast } from "@/components/kit";
import { copyText } from "@/lib/clipboard";
import { guarded } from "@/lib/actionGuard";
import { nearestMatches, similarInOtherBrands } from "@/lib/toolMatch";
import { COLOR_OPTIONS, colorFamilyForHue, filterPaints } from "@/mock/filterPaints";
import { EMPTY_LIBRARY_FILTER, type LibraryFilter, type Paint, type PaintType } from "@/lib/types";
import type { PaintStatus } from "@/components/library/PaintInfoPanelContent";
import { loadPaints } from "@/lib/paints/loader";
import { setPaintOwnershipStatus, bulkAddPaintsToCollection } from "@/lib/actions/paintOwnership";
import type { OwnershipStatus, BulkOwnershipStatus } from "@/lib/paints/ownership";
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
export function LibraryClient({
  flags,
  recipesByPaint,
}: {
  flags: InventoryFlags;
  recipesByPaint: Record<string, { id: string; name: string }[]>;
}) {
  const { toast, node } = useToast();
  const [library, setLibrary] = useState<Paint[] | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_LIBRARY_FILTER);
  const [selected, setSelected] = useState<Paint | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [assigning, setAssigning] = useState<Paint | null>(null);
  const [, startTransition] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();

  // Bulk-select (batch/library-collection-sync item 4) — a lightweight
  // selection mode over the grid/list. Off by default so the action bar
  // never appears until the painter opts in.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelectMode() {
    setSelectMode((on) => !on);
    setSelectedIds(new Set());
  }

  function toggleSelectPaint(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

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
  const recipesForPaint = useMemo(
    () => (selected ? recipesByPaint[selected.id] ?? [] : []),
    [selected, recipesByPaint],
  );

  /** Every Library ownership write (list-view toggles + the panel's
   *  STATUS control) funnels through the same reconcile-backed action, so
   *  OWNED / WISHLIST / NONE stay mutually exclusive here exactly like the
   *  linked Collection row's single `status` column — and each write
   *  creates/updates/removes that linked row too. */
  function applyStatus(paintId: string, status: OwnershipStatus) {
    const before = paints.find((p) => p.id === paintId);
    patchPaint(paintId, { owned: status === "OWNED", wishlisted: status === "WISHLIST" });
    startTransition(async () => {
      // R2-14 — this used to `await` bare and discard the result: offline the
      // rejection escaped the transition into the route error boundary and
      // replaced the whole app while browsing 7,000 paints (losing the filter
      // and the scroll position), and even a HANDLED failure left the chip
      // showing an ownership state that was never stored.
      const res = await guarded(() => setPaintOwnershipStatus({ paintId, status }));
      if (res.ok) return;
      if (before) {
        patchPaint(paintId, { owned: before.owned, wishlisted: before.wishlisted });
      }
      toast(res.error, "red");
    });
  }

  function toggleOwned(p: Paint) {
    applyStatus(p.id, p.owned ? "NONE" : "OWNED");
  }

  function toggleWishlist(p: Paint) {
    applyStatus(p.id, p.wishlisted ? "NONE" : "WISHLIST");
  }

  /** STATUS control (tri-state) — one call per change instead of composing
   *  two independent toggles. */
  function setStatus(next: PaintStatus) {
    const p = selected;
    if (!p) return;
    const status: OwnershipStatus =
      next === "owned" ? "OWNED" : next === "wishlist" ? "WISHLIST" : "NONE";
    applyStatus(p.id, status);
  }

  function bulkAdd(status: BulkOwnershipStatus) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    for (const id of ids) patchPaint(id, { owned: status === "OWNED", wishlisted: status === "WISHLIST" });
    startBulkTransition(async () => {
      const res = await guarded(() =>
        bulkAddPaintsToCollection({ paintIds: ids, status }),
      );
      if (res.ok) {
        toast(
          `Added ${res.data.count} paint${res.data.count === 1 ? "" : "s"} to Collection as ${status}`,
          "green",
        );
        setSelectedIds(new Set());
      } else {
        toast(res.error, "red");
      }
    });
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
      recipesForPaint={recipesForPaint}
      matchResults={matchResults}
      similar={similar}
      onFilterChange={setFilter}
      onClearFilter={() => setFilter(EMPTY_LIBRARY_FILTER)}
      onOpenPaint={setSelected}
      onClosePaint={() => setSelected(null)}
      onToggleOwned={toggleOwned}
      onToggleWishlist={toggleWishlist}
      onSetStatus={setStatus}
      onCopyHex={() => {
        if (!selected) return;
        // R2-1 — was silent either way, so a blocked write was
        // indistinguishable from a successful one.
        void copyText(selected.hex, toast, {
          copied: `Copied ${selected.hex}`,
          failed: `Couldn’t copy — the hex is ${selected.hex}`,
        });
      }}
      onAssignPaint={(p) => setAssigning(p)}
      onJumpHue={(hue) =>
        setFilter((f) => ({ ...f, colors: [colorFamilyForHue(hue)] }))
      }
      onRetry={() => {
        setLibrary(null);
        setReloadKey((k) => k + 1);
      }}
      selectMode={selectMode}
      selectedIds={selectedIds}
      onToggleSelectMode={toggleSelectMode}
      onToggleSelectPaint={toggleSelectPaint}
      onClearSelection={clearSelection}
      onBulkAdd={bulkAdd}
      bulkPending={bulkPending}
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
      // The Library's plain "Add to Recipe" — base-app functionality, free
      // even for non-subscribers (docs/SUBSCRIPTION_PAYWALL.md boundary).
    />
    {node}
    </>
  );
}
