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
 * P16.6 — mobile containment, CSS-WIDTH-DRIVEN (UX-1301). The Round-15
 * audit found the prior, JS-gated fix STILL trapped touch users: gating
 * the bottom-sheet placement on a runtime `isMobile` flag meant that when
 * the flag read false in prod (coarse-pointer/width detection is
 * unreliable), the desktop cell-anchored path ran and pushed the header +
 * × close button above y=0, off-screen and undismissable. JS detection is
 * NOT a reliable signal for layout here.
 *
 * The robust fix: placement is decided ENTIRELY by Tailwind WIDTH media
 * queries (`max-md:` / `md:`), never by JS. There is exactly ONE rendered
 * element with BOTH placements layered as responsive classes:
 *
 *   - **< 768px (`max-md:`):** a TRUE viewport-bottom sheet — `fixed`,
 *     `inset-x-2` (8px gutters), pinned to
 *     `bottom-[calc(60px+env(safe-area-inset-bottom))]` clear of the fixed
 *     bottom tab bar, `top-auto`, `max-h-[70vh]`, body scrolling inside the
 *     clamp. Because `fixed` is relative to the viewport (not the cell
 *     anchor) and `top` is forced `auto` at this width, the header + ×
 *     close + WANT actions are ALWAYS on-screen, thumb-reachable, no matter
 *     which cell was tapped.
 *   - **>= 768px (`md:`):** anchored to the cell (`absolute`), FLIP-ABOVE
 *     when the measured space below can't fit the popover. The flip is the
 *     only thing JS still steers, and it ONLY emits `md:`-scoped classes —
 *     so nothing it computes can ever reach the mobile sheet.
 *
 * Critically, no JS-set inline `top` is ever emitted (the flip uses
 * `md:top-full` / `md:bottom-full` utility classes, not a measured pixel
 * value), and the `max-md:!top-auto` utility guarantees the sheet's top
 * can never be overridden — even by a stray inline style — below 768px.
 * The `isMobile` prop is now used ONLY to skip the desktop measurement
 * effect early; it has ZERO influence on the rendered placement classes.
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
  /** Coarse-pointer / narrow-viewport hint from the grid client. UX-1301:
   *  this is NO LONGER used to choose the placement (that is decided purely
   *  by CSS width media queries so an unreliable runtime flag can't trap
   *  touch users). It is used ONLY as an early-out for the desktop
   *  flip-above measurement effect, so a known-mobile client skips a
   *  needless `getBoundingClientRect`. The rendered layout is identical
   *  whether this is true or false. */
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

  // Desktop (>= 768px) placement only: anchored below the cell by default,
  // flipped above when the measured space below can't fit the popover.
  // `placement` toggles `md:`-scoped utility classes EXCLUSIVELY — below
  // 768px the `max-md:` bottom-sheet classes win regardless, so whatever
  // this computes can never reach the mobile sheet (UX-1301). Measured once
  // on open in a layout effect so the flip happens before paint.
  const [placement, setPlacement] = useState<Placement>("below");
  useLayoutEffect(() => {
    // On a known-mobile client the desktop `md:` classes are inert (the
    // viewport is < 768px), so skip the measurement — it would be a wasted
    // reflow. This early-out is an optimization only; the rendered sheet is
    // CSS-driven and identical whether or not this runs.
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
      // `data-placement` reports the EFFECTIVE placement for tests/debug:
      // a bottom sheet below 768px (width-driven, never JS-driven), else the
      // measured desktop anchor. The desktop value is purely informational
      // below 768px — the `max-md:` classes win there.
      data-placement="sheet md:anchored"
      data-sheet-placement={placement}
      // UX-1301: NO JS-set inline `top` is ever emitted. The flip uses
      // `md:`-scoped utility classes, and `max-md:!top-auto` below forces
      // the sheet's top to `auto` at the highest utility specificity — so
      // the header + × close can never be clipped above the viewport top.
      className={clsx(
        "z-50 frame-strong bg-[var(--color-bg-panel)] shadow-xl",
        "flex flex-col overflow-hidden",
        // --- < 768px: a TRUE viewport-bottom sheet (UX-1301) ---
        // `fixed` is relative to the VIEWPORT, fully decoupled from the cell
        // anchor; pinned above the bottom tab bar (60px + safe-area inset)
        // with 8px gutters; `top` forced `auto` (with `!` so no inline/class
        // top can win) and a 70vh clamp + scrolling body keep the header +
        // × close + WANT actions on-screen, thumb-reachable, for ANY cell.
        "max-md:fixed max-md:inset-x-2 max-md:!top-auto",
        "max-md:bottom-[calc(60px+env(safe-area-inset-bottom,0px))]",
        "max-md:mx-auto max-md:w-auto max-md:max-w-[480px] max-md:max-h-[70vh]",
        // --- >= 768px: cell-anchored, flipping above when no room below ---
        "md:absolute md:left-1/2 md:-translate-x-1/2 md:w-[280px]",
        "md:max-w-[calc(100vw-1.5rem)] md:max-h-[80vh]",
        placement === "above"
          ? "md:bottom-full md:top-auto md:mb-1 md:mt-0"
          : "md:top-full md:bottom-auto md:mt-1 md:mb-0",
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
