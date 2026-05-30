"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";

import {
  setOwnedCount,
  toggleWishlistedPaint,
  markPurchased,
} from "@/lib/actions/inventory";

interface InventoryState {
  ownedCount: number;
  isWishlisted: boolean;
}

const ZERO: InventoryState = { ownedCount: 0, isWishlisted: false };

/**
 * Inventory controls. The `compact` mode renders two icon toggles for
 * the library table row (✓ for owned, ★ for wishlisted). The full mode
 * renders a bottle stepper + the same toggles + a "mark just bought"
 * quick action — used in the detail panel.
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
    optimistic({ isWishlisted: next }, () => toggleWishlistedPaint({ paintId }));
  }

  function justBought() {
    const next = state.ownedCount + 1;
    optimistic({ ownedCount: next }, () => markPurchased({ paintId, deltaCount: 1 }));
  }

  function optimistic(
    patch: Partial<InventoryState>,
    call: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
  ) {
    setError(null);
    const prev = state;
    setState({ ...state, ...patch });
    startTransition(async () => {
      const result = await call();
      if (result.ok === false) {
        setError(result.error);
        setState(prev);
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
              : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]",
            isPending && "opacity-60",
          )}
        >
          {state.ownedCount > 0 ? "✓" : "✗"}
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
              ? "text-[var(--color-amber)]"
              : "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]",
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
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] w-16">
          Owned
        </span>
        <button
          type="button"
          onClick={() => bumpOwned(-1)}
          disabled={state.ownedCount === 0 || isPending}
          className={clsx(
            "tap-target frame px-2 font-mono text-sm",
            state.ownedCount === 0
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)]",
          )}
          aria-label="Decrease owned count"
        >
          −
        </button>
        <span className="font-mono text-base text-[var(--color-fg)] w-8 text-center">
          {state.ownedCount}
        </span>
        <button
          type="button"
          onClick={() => bumpOwned(1)}
          disabled={isPending}
          className="tap-target frame px-2 font-mono text-sm hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
          aria-label="Increase owned count"
        >
          +
        </button>
        <button
          type="button"
          onClick={justBought}
          disabled={isPending}
          className="ml-2 text-xs font-mono px-2 py-1 frame hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)] hover:text-[var(--color-green)]"
        >
          [ Just bought +1 ]
        </button>
      </div>
      <div>
        <button
          type="button"
          onClick={toggleWish}
          disabled={isPending}
          className={clsx(
            "inline-flex items-center gap-2 px-2 py-1 text-xs font-mono frame tap-target",
            state.isWishlisted
              ? "text-[var(--color-amber)] border-[var(--color-amber)]"
              : "text-[var(--color-fg-muted)] hover:text-[var(--color-amber)]",
          )}
          aria-pressed={state.isWishlisted}
        >
          <span aria-hidden>{state.isWishlisted ? "★" : "☆"}</span>
          <span>{state.isWishlisted ? "Wishlisted" : "Add to wishlist"}</span>
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-mono text-[var(--color-red)]">
          [ ! ] {error}
        </p>
      ) : null}
    </div>
  );
}
