"use client";

/**
 * M4.2 / D6.2 — CollectionGapFill.
 *
 * The gap-fill surface: a searchable paint list for marking owned/wanted.
 * When opened from a canvas pick the list is SEEDED with the tapped paint at
 * top + its buildGapFillCandidates near-hue matches; otherwise it starts at a
 * blank search.
 *
 * Placement:
 *   - Mobile (< 768px): true viewport-bottom sheet, portalled to document.body
 *     (same pattern as HeatSinkGapFillPopover — portal escapes any
 *     content-visibility containing block). The `.gap-fill-sheet` class in
 *     globals.css drives the CSS; no JS-set inline styles.
 *   - Desktop (≥ 768px): a persistent non-modal right-panel rendered in-flow
 *     in HeatSinkGridClient (fixed/sticky column). No portal needed — the
 *     canvas never has contain/content-visibility, so fixed works correctly.
 *
 * The placement decision for the portal branch uses matchMedia, not the JS
 * `isMobile` flag, consistent with HeatSinkGapFillPopover's proven pattern.
 *
 * Content:
 *   - SEARCH input: filters allCells by brand+name (case-insensitive).
 *   - Seeded view: tapped paint at top, then its near-hue candidates, then
 *     the rest of the search results.
 *   - Each row: swatch + name + brand + StatePill + "Want" + "Own" actions.
 *   - Results capped to 50 to avoid rendering thousands of rows.
 *   - Dismiss: Escape, click-outside, Back (popstate), visible × close.
 *   - role="dialog" aria-modal="false" (non-modal list panel).
 *
 * No raw hex in classNames — swatches use inline style (data, not token).
 * No cyan on actions. Token colours only.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { setOwnedCount, toggleWishlistedPaint } from "@/lib/actions/inventory";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import type { CoverageState } from "@/lib/paints/coverage";
import {
  buildGapFillCandidates,
  candidateStateLabel,
  gapFillHeading,
} from "./heatSinkHelpers";

const RESULT_CAP = 50;

interface Props {
  /** Full catalog cell list — searched and used for candidate building. */
  allCells: readonly CoverageCell[];
  /** The paint tapped on the canvas, or null for a "browse all" open. */
  seedCell: CoverageCell | null;
  /** Effective coverage state for a paint id, reflecting optimistic overrides. */
  stateForPaint: (id: string, fallback: CoverageState) => CoverageState;
  /** Close the surface. */
  onClose: () => void;
  /** Optimistically mark a paint as wanted after the server action succeeds. */
  onMarkedWanted: (paintId: string) => void;
  /** Optimistically mark a paint as owned after the server action succeeds. */
  onMarkedOwned: (paintId: string) => void;
}

export function CollectionGapFill({
  allCells,
  seedCell,
  stateForPaint,
  onClose,
  onMarkedWanted,
  onMarkedOwned,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"want" | "own" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Portal to body below 768px (same matchMedia pattern as HeatSinkGapFillPopover).
  const [sheetToBody, setSheetToBody] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setSheetToBody(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Focus the search input on open.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Dismiss on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Dismiss on click-outside.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  // Dismiss on browser Back (popstate).
  useEffect(() => {
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  // Build the seeded candidates list when a cell is picked.
  const seedCandidates = useMemo(() => {
    if (!seedCell) return [];
    return buildGapFillCandidates(seedCell, allCells);
  }, [seedCell, allCells]);

  // Filtered search results (case-insensitive brand+name match).
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCells;
    return allCells.filter(
      (c) =>
        c.paint.name.toLowerCase().includes(q) ||
        c.paint.brand.toLowerCase().includes(q),
    );
  }, [allCells, query]);

  // Composed list: seed paint first, then near-hue candidates, then
  // remaining search results (excluding already-shown ids), capped at RESULT_CAP.
  const displayList = useMemo((): CoverageCell[] => {
    const shownIds = new Set<string>();
    const result: CoverageCell[] = [];

    if (seedCell) {
      result.push(seedCell);
      shownIds.add(seedCell.paint.id);

      for (const candidate of seedCandidates) {
        if (shownIds.has(candidate.paint.id)) continue;
        // Find the full CoverageCell for this candidate from allCells.
        const found = allCells.find((c) => c.paint.id === candidate.paint.id);
        if (found) {
          result.push(found);
          shownIds.add(candidate.paint.id);
        }
      }
    }

    for (const cell of searchResults) {
      if (result.length >= RESULT_CAP) break;
      if (shownIds.has(cell.paint.id)) continue;
      result.push(cell);
      shownIds.add(cell.paint.id);
    }

    return result;
  }, [seedCell, seedCandidates, searchResults, allCells]);

  const truncated = searchResults.length > RESULT_CAP && displayList.length >= RESULT_CAP;

  const markWanted = useCallback(
    (paintId: string) => {
      setError(null);
      setPendingId(paintId);
      setPendingAction("want");
      startTransition(async () => {
        const result = await toggleWishlistedPaint({ paintId });
        if (result.ok) {
          if (result.data.isWishlisted) onMarkedWanted(paintId);
          else setError("Already on your wishlist.");
        } else {
          setError(result.error);
        }
        setPendingId(null);
        setPendingAction(null);
      });
    },
    [onMarkedWanted],
  );

  const markOwned = useCallback(
    (paintId: string) => {
      setError(null);
      setPendingId(paintId);
      setPendingAction("own");
      startTransition(async () => {
        const result = await setOwnedCount({ paintId, count: 1 });
        if (result.ok) {
          onMarkedOwned(paintId);
        } else {
          setError(result.error);
        }
        setPendingId(null);
        setPendingAction(null);
      });
    },
    [onMarkedOwned],
  );

  const seedState = seedCell
    ? stateForPaint(seedCell.paint.id, seedCell.state)
    : null;

  const panel = (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="false"
      aria-label={
        seedCell
          ? seedCell.paint.brand + " " + seedCell.paint.name + " — gap fill"
          : "Browse and mark paints"
      }
      className={clsx(
        "z-50 frame-strong bg-[var(--color-bg-panel)] shadow-xl",
        "flex flex-col overflow-hidden",
        // Mobile: bottom sheet via the globals.css rule.
        "gap-fill-sheet",
        // Desktop: in-flow right panel (positioned by the parent).
        "md:static md:shadow-none md:h-full md:min-h-0",
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="shrink-0 flex items-start gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <div className="min-w-0 flex-1">
          {seedCell ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-6 w-6 shrink-0 rounded-sm border border-[var(--color-border-strong)]"
                  style={{ backgroundColor: seedCell.paint.hex }}
                />
                <div className="min-w-0">
                  <p className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
                    {seedCell.paint.brand}
                  </p>
                  <p className="font-mono text-xs text-[var(--color-fg)] truncate">
                    {seedCell.paint.name}
                  </p>
                </div>
                {seedState !== null ? <StatePill state={seedState} /> : null}
              </div>
              <p className="mt-1 text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
                {gapFillHeading(seedState ?? "none", seedCandidates.length)}
              </p>
            </>
          ) : (
            <p className="font-mono text-xs text-[var(--color-fg)]">
              Fill gaps · browse paints
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gap-fill panel"
          className="tap-target text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] px-1 shrink-0"
        >
          ×
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--color-border)]">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand or name…"
          aria-label="Search paints"
          className={clsx(
            "w-full frame px-2 py-1.5 font-mono text-xs",
            "bg-[var(--color-bg-elevated)] text-[var(--color-fg)]",
            "placeholder:text-[var(--color-fg-muted)]",
          )}
        />
      </div>

      {/* Body — scrollable list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {error ? (
          <p role="alert" className="text-2xs font-mono text-[var(--color-red)] px-1 py-0.5">
            {error}
          </p>
        ) : null}

        {displayList.length === 0 ? (
          <p className="text-2xs font-mono text-[var(--color-fg-muted)] px-1">
            No paints match this search.
          </p>
        ) : (
          <ul aria-label="Paint list" className="space-y-0.5">
            {displayList.map((cell, listIndex) => {
              const liveState = stateForPaint(cell.paint.id, cell.state);
              const isSeed = seedCell?.paint.id === cell.paint.id;
              const isWantPending =
                isPending &&
                pendingId === cell.paint.id &&
                pendingAction === "want";
              const isOwnPending =
                isPending &&
                pendingId === cell.paint.id &&
                pendingAction === "own";
              return (
                <li
                  key={cell.paint.id}
                  className={clsx(
                    "flex items-center gap-2 px-1 py-1 rounded-sm",
                    isSeed &&
                      "bg-[color-mix(in_srgb,var(--color-fg-muted)_8%,transparent)]",
                    listIndex === 0 && seedCell && "border-b border-[var(--color-border)] pb-2 mb-1",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-sm border border-[var(--color-border-strong)]"
                    style={{ backgroundColor: cell.paint.hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-2xs text-[var(--color-fg)] truncate">
                      {cell.paint.name}
                    </span>
                    <span className="block text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
                      {cell.paint.brand}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatePill state={liveState} />
                    {liveState !== "owned" ? (
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        disabled={isWantPending || isPending}
                        onClick={() => markWanted(cell.paint.id)}
                        aria-label={"Mark " + cell.paint.name + " as wanted"}
                      >
                        {isWantPending ? "…" : "Want"}
                      </Button>
                    ) : null}
                    {liveState !== "owned" ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isOwnPending || isPending}
                        onClick={() => markOwned(cell.paint.id)}
                        aria-label={"Mark " + cell.paint.name + " as owned"}
                      >
                        {isOwnPending ? "…" : "Own"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {truncated ? (
          <p className="text-2xs font-mono text-[var(--color-fg-muted)] px-1 pt-1">
            Showing first {RESULT_CAP} results — refine your search to narrow.
          </p>
        ) : null}
      </div>
    </div>
  );

  return sheetToBody ? createPortal(panel, document.body) : panel;
}

/**
 * Coverage-state pill. Owned → green, wanted → amber, none → muted.
 * Token colours only — no raw hex, no cyan.
 */
function StatePill({ state }: { state: CoverageState }) {
  const cls =
    state === "owned"
      ? "text-[var(--color-green)] border-[var(--color-green)]"
      : state === "wanted"
        ? "text-[var(--color-amber)] border-[var(--color-amber)]"
        : "text-[var(--color-fg-muted)] border-[var(--color-border)]";
  return (
    <span
      className={clsx(
        "inline-flex items-center px-1.5 py-0.5 rounded-sm border",
        "font-mono text-2xs uppercase tracking-wider whitespace-nowrap",
        cls,
      )}
    >
      {candidateStateLabel(state)}
    </span>
  );
}
