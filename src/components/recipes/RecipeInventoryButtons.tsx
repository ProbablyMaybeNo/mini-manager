"use client";

import { useEffect, useState, useTransition } from "react";

import {
  setOwnedCount,
  toggleWishlistedPaint,
} from "@/lib/actions/inventory";
import { Button } from "@/components/ui/Button";
import { LogTag } from "@/components/ui/LogTag";
import { useToast } from "@/components/ui/Toast";
import { WANTED_TOOLTIP } from "@/components/library/InventoryControls";

interface InventoryState {
  ownedCount: number;
  isWishlisted: boolean;
}

/**
 * WISHLIST + OWNED quick-toggles for the recipe slot side panel.
 *
 * Item 2 — the slide-out panel's currently-selected paint (the editing
 * slot's catalog paint) gets two top-of-panel buttons:
 *   WISHLIST — yellow border + text, black fill (warning outline). Maps to
 *              the library star, i.e. `toggleWishlistedPaint`.
 *   OWNED    — neon-green border + text, black fill (success outline). Maps
 *              to the library owned toggle, i.e. `setOwnedCount` (0 ⇄ 1).
 *
 * Same action path + optimistic-revert discipline as the library
 * `InventoryControls` so the two surfaces stay in lock-step. Only renders
 * for a catalog paint — a custom-hex slot has no inventory row to toggle.
 */
export function RecipeInventoryButtons({
  paintId,
  initial,
}: {
  paintId: string;
  initial: InventoryState;
}) {
  const [state, setState] = useState<InventoryState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  // Re-sync when the panel switches to a different paint without unmounting.
  useEffect(() => {
    setState(initial);
    setError(null);
  }, [paintId, initial]);

  function optimistic(
    patch: Partial<InventoryState>,
    call: () => Promise<
      { ok: true; data: unknown } | { ok: false; error: string }
    >,
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

  function toggleWish() {
    const next = !state.isWishlisted;
    optimistic(
      { isWishlisted: next },
      () => toggleWishlistedPaint({ paintId }),
      () => (next ? toast.success("Marked as wanted") : toast.info("Unmarked")),
    );
  }

  function toggleOwned() {
    const next = state.ownedCount > 0 ? 0 : 1;
    optimistic(
      { ownedCount: next },
      () => setOwnedCount({ paintId, count: next }),
      () =>
        next > 0 ? toast.success("Marked as owned") : toast.info("Marked unowned"),
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={toggleWish}
          disabled={isPending}
          variant="warning"
          size="sm"
          tone={state.isWishlisted ? "solid" : "outline"}
          aria-pressed={state.isWishlisted}
          title={WANTED_TOOLTIP}
        >
          <span aria-hidden>{state.isWishlisted ? "★" : "☆"}</span>
          <span>{state.isWishlisted ? "Wishlisted" : "Wishlist"}</span>
        </Button>
        <Button
          type="button"
          onClick={toggleOwned}
          disabled={isPending}
          variant="success"
          size="sm"
          tone={state.ownedCount > 0 ? "solid" : "outline"}
          aria-pressed={state.ownedCount > 0}
        >
          <span aria-hidden>{state.ownedCount > 0 ? "✓" : "○"}</span>
          <span>{state.ownedCount > 0 ? "Owned" : "Mark owned"}</span>
        </Button>
      </div>
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-2xs font-mono text-[var(--color-red)]"
        >
          <LogTag variant="err" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
