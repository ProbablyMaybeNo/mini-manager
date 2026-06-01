"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";

import {
  setOwnedCount,
  toggleWishlistedPaint,
} from "@/lib/actions/inventory";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";
import { useToast } from "@/components/ui/Toast";

interface InventoryState {
  ownedCount: number;
  isWishlisted: boolean;
}

const ZERO: InventoryState = { ownedCount: 0, isWishlisted: false };

/**
 * Inventory controls. The `compact` mode renders two icon toggles for
 * the library table row (✓ for owned, ★ for wishlisted). The full mode
 * renders a bottle stepper + the wishlist toggle — used in the detail
 * panel. NB-3: the redundant "Just bought +1" quick action was removed
 * in favour of the +/- stepper which already increments and revalidates.
 *
 * Uses optimistic local state during the server-action round-trip;
 * reverts if the action returns `{ ok: false }`.
 */
export function InventoryControls({
  paintId,
  initial = ZERO,
  variant = "compact",
}: {
  paintId: string;
  initial?: InventoryState | undefined;
  variant?: "compact" | "full";
}) {
  const [state, setState] = useState<InventoryState>(initial ?? ZERO);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function bumpOwned(delta: 1 | -1) {
    const next = Math.max(0, state.ownedCount + delta);
    if (next === state.ownedCount) return;
    optimistic({ ownedCount: next }, () => setOwnedCount({ paintId, count: next }));
  }

  function toggleOwned() {
    const next = state.ownedCount > 0 ? 0 : 1;
    optimistic({ ownedCount: next }, () => setOwnedCount({ paintId, count: next }));
  }

  function toggleWish() {
    const next = !state.isWishlisted;
    optimistic(
      { isWishlisted: next },
      () => toggleWishlistedPaint({ paintId }),
      () =>
        next
          ? toast.success("Added to wishlist")
          : toast.info("Removed from wishlist"),
    );
  }

  function optimistic(
    patch: Partial<InventoryState>,
    call: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
    onSuccess?: () => void,
  ) {
    setError(null);
    const prev = state;
    setState({ ...state, ...patch });
    startTransition(async () => {
      const result = await call();
      if (result.ok === false) {
        setError(result.error);
        setState(prev);
        toast.error(result.error);
      } else {
        onSuccess?.();
      }
    });
  }

  if (variant === "compact") {
    return (
      <span
        className="contents"
        onClick={(e) => {
          // The compact controls live inside a clickable row. Stop the
          // row's open-detail click from firing when the user taps a
          // toggle.
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleOwned();
          }}
          aria-pressed={state.ownedCount > 0}
          aria-label={state.ownedCount > 0 ? "Mark as not owned" : "Mark as owned"}
          className={clsx(
            "inline-flex justify-center items-center font-mono text-xs min-h-[24px] py-1",
            state.ownedCount > 0
              ? "text-[var(--color-green)]"
              : "text-[var(--color-fg-subtle)] hover:text-[var(--color-green)]",
            isPending && "opacity-60",
          )}
        >
          {state.ownedCount > 0 ? "✓" : "○"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWish();
          }}
          aria-pressed={state.isWishlisted}
          aria-label={state.isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={clsx(
            "inline-flex justify-center items-center font-mono text-xs min-h-[24px] py-1",
            state.isWishlisted
              ? "text-[var(--color-yellow)]"
              : "text-[var(--color-fg-subtle)] hover:text-[var(--color-yellow)]",
            isPending && "opacity-60",
          )}
        >
          {state.isWishlisted ? "★" : "☆"}
        </button>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Owned stepper — NB-3 simplified: the +/− stepper covers every
          in-place adjustment. The separate "Just bought +1" button was
          redundant (the + already increments + revalidates) so it was
          removed. markPurchased keeps its server-action surface for the
          MarkBoughtModal wishlist flow. */}
      {/* Owned cluster — Ross feedback 2026-06-01: all controls share
          the green semantic. `−` is green-outlined (decrement), the
          count reads in green, `+` is green-outlined (increment). The
          existing dim-cursor when count===0 prevents accidental drops
          below zero. */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-green)] w-16">
          Owned
        </span>
        <button
          type="button"
          onClick={() => bumpOwned(-1)}
          disabled={state.ownedCount === 0 || isPending}
          className={clsx(
            "tap-target inline-flex items-center justify-center min-w-[32px] px-2 py-1 font-mono text-sm leading-none rounded-sm border",
            "border-[var(--color-green)] text-[var(--color-green)]",
            state.ownedCount === 0
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-[color-mix(in_srgb,var(--color-green)_12%,transparent)]",
          )}
          aria-label="Decrease owned count"
        >
          −
        </button>
        <span className="font-mono text-base text-[var(--color-green)] w-8 text-center">
          {state.ownedCount}
        </span>
        <button
          type="button"
          onClick={() => bumpOwned(1)}
          disabled={isPending}
          className="tap-target inline-flex items-center justify-center min-w-[32px] px-2 py-1 font-mono text-sm leading-none rounded-sm border border-[var(--color-green)] text-[var(--color-green)] hover:bg-[color-mix(in_srgb,var(--color-green)_12%,transparent)]"
          aria-label="Increase owned count"
        >
          +
        </button>
      </div>
      {/* Add-to-wishlist — P13.10: routed through the Button primitive.
          `variant="warning"` is the canonical wishlist CTA after P13.1.
          When active we ship the solid pastel-yellow fill (the new
          default tone); when inactive we drop to `tone="outline"` so
          the inert state reads as low-emphasis without losing the
          yellow palette anchor. */}
      <div>
        <Button
          type="button"
          onClick={toggleWish}
          disabled={isPending}
          variant="warning"
          size="sm"
          tone={state.isWishlisted ? "solid" : "outline"}
          aria-pressed={state.isWishlisted}
        >
          <span aria-hidden>{state.isWishlisted ? "★" : "☆"}</span>
          <span>{state.isWishlisted ? "Wishlisted" : "Add to wishlist"}</span>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-xs font-mono text-[var(--color-red)]">
          <LogTag variant="err" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
