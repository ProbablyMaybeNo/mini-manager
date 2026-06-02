"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { toggleWishlistedPaint } from "@/lib/actions/inventory";
import type { CoverageState } from "@/lib/paints/coverage";
import type { CoverageCell } from "@/db/queries/paintCoverage";
import {
  buildGapFillCandidates,
  candidateStateLabel,
  gapFillHeading,
  type GapFillCandidate,
} from "./heatSinkHelpers";

/**
 * P16.5 — gap-fill popover.
 *
 * Opens anchored to a tapped grid cell. Shows the tapped paint (swatch +
 * brand + name + coverage state) and its nearest-hue catalog neighbours,
 * each tagged owned / wanted / none. For any not-already-owned paint a
 * one-tap "Mark as wanted" flips `inventory_entry.is_wishlisted` via the
 * existing `toggleWishlistedPaint` server action (the UX-1001 wishlist
 * path — reused, not re-implemented) and optimistically restyles the cell
 * border to amber via the parent's `onMarkedWanted` callback.
 *
 * Owned cells open the same popover framed "You own this — N near matches"
 * (no buy nag). Dismisses on Escape + click-outside, `z-50`, viewport-
 * clamped via `max-w-[calc(100vw-...)]` — matching the `PaintSlotPicker` /
 * `InlineCellPopover` primitives.
 *
 * P16.6 — mobile containment (UX-1203). The Round-12 audit found the
 * anchored-below popover overflowing the fold at 375 and hiding its action
 * buttons behind the fixed bottom nav at 414. Two placements now:
 *
 *   - **Mobile (< md):** a bottom SHEET — `fixed` to the bottom of the
 *     viewport, clear of the fixed bottom tab bar (its `min-h-[56px]` +
 *     `env(safe-area-inset-bottom)`), with its body scrolling inside a
 *     `max-h` clamp. The "Mark as wanted" actions are always inside that
 *     scroll area, so they're reachable thumb-only no matter which cell
 *     was tapped.
 *   - **Desktop (>= md):** anchored to the cell, but FLIP-ABOVE when the
 *     measured space below the anchor can't fit the popover (collision-
 *     aware placement without pulling in a positioning lib). Clamped to
 *     the viewport height via `max-h`.
 *
 * No raw hex in classes — swatch fills come from each paint's stored hex
 * (data, not a token) via inline style; the wishlist add is a `success`
 * (solid neon-green) Button per the locked palette. No cyan on the action.
 */

/** Placement of the desktop-anchored popover relative to its cell. */
type Placement = "below" | "above";

interface Props {
  /** The tapped cell. */
  cell: CoverageCell;
  /** Every catalog cell — candidates rank against the full set so a near
   *  match that the painter doesn't own yet still surfaces. */
  allCells: readonly CoverageCell[];
  /** Coarse-pointer / narrow-viewport gate from the grid client. When
   *  true the popover renders as a TRUE viewport-bottom sheet decoupled
   *  from the cell anchor (UX-1301); when false it's the desktop
   *  cell-anchored / flip-above popover. */
  isMobile: boolean;
  /** Local coverage state for a paint id, reflecting any optimistic flips
   *  this session so the popover re-tags candidates after a "Mark as
   *  wanted" without a refetch. Falls back to the cell's own state. */
  stateForPaint: (paintId: string, fallback: CoverageState) => CoverageState;
  /** Close the popover (Escape / click-outside / dismiss button). */
  onClose: () => void;
  /** Optimistically mark a paint as wanted (amber border) after the
   *  server action succeeds. */
  onMarkedWanted: (paintId: string) => void;
}

export function HeatSinkGapFillPopover({
  cell,
  allCells,
  isMobile,
  stateForPaint,
  onClose,
  onMarkedWanted,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Desktop placement: anchored below the cell by default, flipped above
  // when the measured space below can't fit the popover. Mobile uses a
  // fixed bottom sheet instead (CSS breakpoint), so this only steers the
  // `md:` anchored layout. Measured once on open in a layout effect so the
  // flip happens before paint (no visible jump).
  const [placement, setPlacement] = useState<Placement>("below");
  useLayoutEffect(() => {
    // Mobile is a fixed bottom sheet — no cell-anchored measurement, so
    // the flip logic must NOT run (it's the desktop branch only). This
    // also keeps the bottom sheet's top pinned to `auto` with nothing
    // measuring/clobbering it (UX-1301).
    if (isMobile) return;
    const el = rootRef.current;
    const anchor = el?.parentElement;
    if (!el || !anchor) return;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverHeight = el.offsetHeight;
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    // Flip above only when below can't fit the popover but above can —
    // otherwise stay below (the sheet/clamp handles the squeeze case).
    setPlacement(
      spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "above" : "below",
    );
  }, [isMobile]);

  // Escape + click-outside dismiss — matches the popover primitives.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [onClose]);

  const targetState = stateForPaint(cell.paint.id, cell.state);
  const candidates: GapFillCandidate[] = buildGapFillCandidates(cell, allCells);

  const markWanted = (paintId: string) => {
    setError(null);
    setPendingId(paintId);
    startTransition(async () => {
      const result = await toggleWishlistedPaint({ paintId });
      if (result.ok) {
        // The toggle action flips the boolean; when it lands true the paint
        // is wanted. Reflect that optimistically as an amber border.
        if (result.data.isWishlisted) onMarkedWanted(paintId);
        else setError("That paint was already on your wishlist.");
      } else {
        setError(result.error);
      }
      setPendingId(null);
    });
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={
        cell.paint.brand + " " + cell.paint.name + " — fill this gap"
      }
      data-placement={isMobile ? "sheet" : placement}
      data-sheet={isMobile ? "" : undefined}
      // UX-1301: on mobile, FORCE `top: auto` via an inline style so the
      // bottom sheet can never inherit / be overridden by the desktop
      // cell-anchored top (the regression where an inline `top:-359px`
      // pushed the header + × close button above y=0, off-screen). Inline
      // style is the highest-specificity layer short of `!important`, and
      // since we render the mobile branch with NO anchored top at all,
      // nothing competes with it. Desktop leaves positioning to classes.
      style={isMobile ? { top: "auto" } : undefined}
      className={clsx(
        "z-50 frame-strong bg-[var(--color-bg-panel)] shadow-xl",
        "flex flex-col overflow-hidden",
        isMobile
          ? clsx(
              // Mobile: a TRUE viewport-bottom sheet, fully decoupled from
              // the cell anchor — `fixed` to the viewport, pinned above the
              // bottom tab bar (60px + safe-area inset), the BODY scrolls
              // inside a 70vh clamp so the header + × close + WANT actions
              // are always on-screen and reachable thumb-only (UX-1301).
              "fixed left-2 right-2 -translate-x-0",
              "bottom-[calc(60px+env(safe-area-inset-bottom,0px))]",
              "w-auto max-w-[480px] mx-auto max-h-[70vh]",
            )
          : clsx(
              // Desktop: anchored to the cell, flipping above when there
              // isn't room below. Clamped to viewport height.
              "absolute left-1/2 -translate-x-1/2 w-[280px]",
              "max-w-[calc(100vw-1.5rem)] max-h-[80vh]",
              placement === "above"
                ? "bottom-full top-auto mb-1 mt-0"
                : "top-full bottom-auto mt-1 mb-0",
            ),
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header — the tapped paint. Pinned (shrink-0) so the body below
          scrolls under it inside the clamped sheet. */}
      <div className="shrink-0 flex items-start gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <span
          aria-hidden
          className="mt-0.5 h-7 w-7 shrink-0 rounded-sm border border-[var(--color-border-strong)]"
          style={{ backgroundColor: cell.paint.hex }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
            {cell.paint.brand}
          </p>
          <p className="font-mono text-xs text-[var(--color-fg)] truncate">
            {cell.paint.name}
          </p>
          <StatePill state={targetState} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gap-fill popover"
          className="tap-target text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] px-1"
        >
          ×
        </button>
      </div>

      {/* Body — scrolls inside the clamped sheet so the Mark-as-wanted
          actions stay reachable even when the popover is taller than the
          space above the bottom nav (UX-1203). */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <p
          className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]"
          data-testid="gap-fill-heading"
        >
          {gapFillHeading(targetState, candidates.length)}
        </p>

        {/* The tapped paint, if unowned, gets its own mark-as-wanted. */}
        {targetState === "none" ? (
          <Button
            type="button"
            variant="success"
            size="sm"
            disabled={isPending && pendingId === cell.paint.id}
            onClick={() => markWanted(cell.paint.id)}
            aria-label={"Mark " + cell.paint.name + " as wanted"}
            className="w-full"
          >
            {isPending && pendingId === cell.paint.id
              ? "Adding…"
              : "Mark as wanted"}
          </Button>
        ) : null}

        {error ? (
          <p role="alert" className="text-2xs font-mono text-[var(--color-red)]">
            {error}
          </p>
        ) : null}

        {/* Near-hue candidates. */}
        {candidates.length === 0 ? (
          <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
            No near matches in the catalog.
          </p>
        ) : (
          <ul aria-label="Near-hue candidates" className="space-y-1">
            {candidates.map((candidate) => {
              const liveState = stateForPaint(
                candidate.paint.id,
                candidate.state,
              );
              const pending = isPending && pendingId === candidate.paint.id;
              return (
                <li
                  key={candidate.paint.id}
                  className="flex items-center gap-2"
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-sm border border-[var(--color-border-strong)]"
                    style={{ backgroundColor: candidate.paint.hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-2xs text-[var(--color-fg)] truncate">
                      {candidate.paint.name}
                    </span>
                    <span className="block text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] truncate">
                      {candidate.paint.brand}
                    </span>
                  </span>
                  {liveState === "none" ? (
                    <Button
                      type="button"
                      variant="success"
                      size="sm"
                      disabled={pending}
                      onClick={() => markWanted(candidate.paint.id)}
                      aria-label={
                        "Mark " + candidate.paint.name + " as wanted"
                      }
                    >
                      {pending ? "…" : "Want"}
                    </Button>
                  ) : (
                    <StatePill state={liveState} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Coverage-state pill. Owned → green, wanted → amber, none → muted. Token
 * colours only — no raw hex, no cyan.
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
