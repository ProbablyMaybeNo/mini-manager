"use client";

import { useState } from "react";
import { Button, Panel, SearchField, SegmentedToggle, SlideOutPanel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { LibraryFilter, MatchResult, Paint } from "@/lib/types";
import { ColorMapRail } from "./ColorMapRail";
import { FilterPanelContent } from "./FilterPanelContent";
import { PaintInfoPanelContent } from "./PaintInfoPanelContent";
import { PaintListTable } from "./PaintListTable";
import { SwatchWall } from "./SwatchWall";

export type LibraryStatus = "ready" | "loading" | "error";

export interface LibraryViewProps {
  paints: Paint[];
  totalCount: number;
  filter: LibraryFilter;
  colorOptions: string[];
  brandOptions: string[];
  status?: LibraryStatus;
  // selected paint detail (host-provided derived data)
  selectedPaint: Paint | null;
  ownedCount: number;
  matchResults: MatchResult[];
  similar: Paint[];
  // callbacks
  onFilterChange: (filter: LibraryFilter) => void;
  onClearFilter: () => void;
  onOpenPaint: (paint: Paint) => void;
  onClosePaint: () => void;
  onToggleOwned: (paint: Paint) => void;
  onToggleWishlist: (paint: Paint) => void;
  onStepOwned: (delta: number) => void;
  onWishlist: () => void;
  onCopyHex: () => void;
  onAssignPaint: (paint: Paint) => void;
  onJumpHue?: (hue: number) => void;
  onRetry?: () => void;
}

export function LibraryView(props: LibraryViewProps) {
  const {
    paints,
    totalCount,
    filter,
    colorOptions,
    brandOptions,
    status = "ready",
    selectedPaint,
    ownedCount,
    matchResults,
    similar,
    onFilterChange,
    onClearFilter,
    onOpenPaint,
    onClosePaint,
    onToggleOwned,
    onToggleWishlist,
    onStepOwned,
    onWishlist,
    onCopyHex,
    onAssignPaint,
    onJumpHue,
    onRetry,
  } = props;

  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterOpen, setFilterOpen] = useState(false);

  // While the Dexie catalog populates (~2–3.5s) the view toggle and filter
  // have no data to act on — disable them until paints are ready (UX-013).
  const loading = status === "loading";

  const activeFilters =
    filter.colors.length + filter.brands.length + filter.status.length + (filter.hex ? 1 : 0);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader
        title="LIBRARY"
        tagline={`Growing library of ${totalCount.toLocaleString()} paints across all the major companies.`}
        actions={
          <>
            <div className="w-44">
              <SearchField
                name="library-search"
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
          </>
        }
      />

      {status === "error" ? (
        <Panel label="ERROR" accent="red" className="max-w-md p-6">
          <p className="font-mono text-sm text-red">▸ Couldn’t load the library.</p>
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
          <Panel label={view === "grid" ? "SWATCHES" : "PAINTS"} className="min-h-0 flex-1 overflow-hidden">
            {loading ? (
              <div className="h-full overflow-y-auto p-4">
                <div
                  className="flex h-full min-h-[300px] animate-pulse flex-col items-center justify-center gap-2 bg-cyan/5"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <span className="font-osd text-xs uppercase tracking-[0.18em] text-cyan text-glow-cyan">
                    ▸ Loading{totalCount > 0 ? ` ${totalCount.toLocaleString()}` : ""} paints…
                  </span>
                  <span className="font-mono text-[10px] text-fg-faint">
                    Building the local catalog index
                  </span>
                </div>
              </div>
            ) : view === "grid" ? (
              <SwatchWall paints={paints} onOpenPaint={onOpenPaint} />
            ) : (
              <PaintListTable
                paints={paints}
                onOpenPaint={onOpenPaint}
                onToggleOwned={onToggleOwned}
                onToggleWishlist={onToggleWishlist}
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
        width="max-w-xs"
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
            ownedCount={ownedCount}
            matchResults={matchResults}
            similar={similar}
            onStepOwned={onStepOwned}
            onWishlist={onWishlist}
            onCopyHex={onCopyHex}
            onAssignPaint={onAssignPaint}
          />
        )}
      </SlideOutPanel>
    </div>
  );
}
