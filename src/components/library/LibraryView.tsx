"use client";

import { useState } from "react";
import { Button, Panel, SearchField, SegmentedToggle, SlideOutPanel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { LibraryFilter, MatchResult, Paint } from "@/lib/types";
import type { BulkOwnershipStatus } from "@/lib/paints/ownership";
import { ColorMapRail } from "./ColorMapRail";
import { FilterPanelContent } from "./FilterPanelContent";
import { PaintInfoPanelContent, type PaintStatus } from "./PaintInfoPanelContent";
import { PaintListTable } from "./PaintListTable";
import { SwatchWall } from "./SwatchWall";

export type LibraryStatus = "ready" | "loading" | "error";

export interface LibraryViewProps {
  paints: Paint[];
  totalCount: number;
  filter: LibraryFilter;
  colorOptions: string[];
  brandOptions: string[];
  typeOptions: string[];
  status?: LibraryStatus;
  // selected paint detail (host-provided derived data)
  selectedPaint: Paint | null;
  recipesForPaint: { id: string; name: string }[];
  matchResults: MatchResult[];
  similar: Paint[];
  // callbacks
  onFilterChange: (filter: LibraryFilter) => void;
  onClearFilter: () => void;
  onOpenPaint: (paint: Paint) => void;
  onClosePaint: () => void;
  onToggleOwned: (paint: Paint) => void;
  onToggleWishlist: (paint: Paint) => void;
  onSetStatus: (status: PaintStatus) => void;
  onCopyHex: () => void;
  onAssignPaint: (paint: Paint) => void;
  onJumpHue?: (hue: number) => void;
  onRetry?: () => void;
  // bulk "Add to Collection" (batch/library-collection-sync item 4)
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelectMode: () => void;
  onToggleSelectPaint: (paintId: string) => void;
  onClearSelection: () => void;
  onBulkAdd: (status: BulkOwnershipStatus) => void;
  bulkPending?: boolean;
}

export function LibraryView(props: LibraryViewProps) {
  const {
    paints,
    totalCount,
    filter,
    colorOptions,
    brandOptions,
    typeOptions,
    status = "ready",
    selectedPaint,
    recipesForPaint,
    matchResults,
    similar,
    onFilterChange,
    onClearFilter,
    onOpenPaint,
    onClosePaint,
    onToggleOwned,
    onToggleWishlist,
    onSetStatus,
    onCopyHex,
    onAssignPaint,
    onJumpHue,
    onRetry,
    selectMode,
    selectedIds,
    onToggleSelectMode,
    onToggleSelectPaint,
    onClearSelection,
    onBulkAdd,
    bulkPending = false,
  } = props;

  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterOpen, setFilterOpen] = useState(false);

  // While the Dexie catalog populates (~2–3.5s) the view toggle and filter
  // have no data to act on — disable them until paints are ready (UX-013).
  const loading = status === "loading";

  const activeFilters =
    filter.colors.length +
    filter.brands.length +
    filter.types.length +
    filter.status.length +
    (filter.hex ? 1 : 0);

  return (
    <div className="flex h-full flex-col gap-4 p-3 md:gap-6 md:p-6">
      <PageHeader
        title="LIBRARY"
        tagline={`// every paint on the market — mark what you own or want (${totalCount.toLocaleString()} across all the major brands)`}
        taglineClassName="font-body text-body"
        actions={
          <>
            <div className="w-44">
              <SearchField
                name="library-search"
                aria-label="Search the paint library"
                value={filter.search ?? ""}
                onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
              />
            </div>
            <SegmentedToggle
              aria-label="View mode"
              options={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
              ]}
              value={view}
              onChange={setView}
              disabled={loading}
            />
            <Button variant="secondary" disabled={loading} onClick={() => setFilterOpen(true)}>
              Filter{activeFilters ? ` (${activeFilters})` : ""}
            </Button>
            <Button
              variant={selectMode ? "outlineCyan" : "secondary"}
              disabled={loading}
              onClick={onToggleSelectMode}
              aria-pressed={selectMode}
            >
              {selectMode ? "Done" : "Select"}
            </Button>
          </>
        }
      />

      {/* Bulk "Add to Collection" action bar (batch/library-collection-sync
          item 4) — only appears once something is selected, so select mode
          on its own stays out of the way. */}
      {selectMode && selectedIds.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk paint actions"
          className="flex flex-wrap items-center gap-3 border border-cyan/40 bg-cyan/5 px-4 py-3"
        >
          <span className="font-body text-body text-fg">
            {selectedIds.size} paint{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <span className="label-osd text-fg-dim">Add to Collection</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkPending}
            onClick={() => onBulkAdd("OWNED")}
          >
            ▸ Owned
          </Button>
          <Button
            variant="outlineYellow"
            size="sm"
            disabled={bulkPending}
            onClick={() => onBulkAdd("WISHLIST")}
          >
            ▸ Wishlist
          </Button>
          <Button variant="tertiary" size="sm" disabled={bulkPending} onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      )}

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-body text-body text-red-text">▸ Couldn’t load the library.</p>
          {onRetry && (
            <div className="mt-4">
              <Button variant="danger" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}
        </Panel>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <Panel className="min-h-0 flex-1 overflow-hidden">
            {loading ? (
              <div className="h-full overflow-y-auto p-4">
                <div
                  className="flex h-full min-h-[300px] animate-pulse flex-col items-center justify-center gap-2 rounded-[12px] border border-border bg-surface-2"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <span className="label-osd text-cyan-lite">
                    ▸ Loading{totalCount > 0 ? ` ${totalCount.toLocaleString()}` : ""} paints…
                  </span>
                  <span className="font-body text-body text-fg">
                    Building the local catalog index
                  </span>
                </div>
              </div>
            ) : view === "grid" ? (
              <SwatchWall
                paints={paints}
                onOpenPaint={onOpenPaint}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelectPaint}
              />
            ) : (
              <PaintListTable
                paints={paints}
                onOpenPaint={onOpenPaint}
                onToggleOwned={onToggleOwned}
                onToggleWishlist={onToggleWishlist}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelectPaint}
              />
            )}
          </Panel>
          <ColorMapRail paints={paints} onJumpHue={onJumpHue} />
        </div>
      )}

      {/* Filter slide-out */}
      <SlideOutPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter"
        footer={
          <Button variant="primary" className="w-full" onClick={() => setFilterOpen(false)}>
            Apply
          </Button>
        }
      >
        <FilterPanelContent
          value={filter}
          colorOptions={colorOptions}
          brandOptions={brandOptions}
          typeOptions={typeOptions}
          onChange={onFilterChange}
          onClear={onClearFilter}
        />
      </SlideOutPanel>

      {/* Paint-info slide-out */}
      <SlideOutPanel
        open={selectedPaint != null}
        onClose={onClosePaint}
        breadcrumb={selectedPaint ? `LIBRARY ▸ ${selectedPaint.brand}` : "LIBRARY"}
        title={selectedPaint?.name ?? ""}
      >
        {selectedPaint && (
          <PaintInfoPanelContent
            paint={selectedPaint}
            recipesForPaint={recipesForPaint}
            matchResults={matchResults}
            similar={similar}
            onSetStatus={onSetStatus}
            onCopyHex={onCopyHex}
            onAssignPaint={onAssignPaint}
          />
        )}
      </SlideOutPanel>
    </div>
  );
}
