"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { bumpCounter } from "@/lib/actions/counters";
import { advanceSlot } from "@/lib/actions/stepCompletion";

interface Props {
  projectId: string;
  /** Currently-active slot (zone) id, or null when none is set. The
   *  "Advance slot" action operates on this slot. */
  activeSlotId: string | null;
  /** `+ Prime` is only offered when there's headroom (buildCount >
   *  primeCount); priming a model that isn't built yet violates the
   *  cascade, so we hide the affordance rather than surface an error. */
  canPrime: boolean;
  /** Search-param key the active slot is persisted to. Default
   *  `focusSlot` for the dashboard FOCUS panel. */
  slotParamKey?: string;
}

/**
 * P15.0 — Inline quick-action buttons in the FOCUS header.
 *
 *   + Paint       — bumps paintCount via the shared bumpCounter action.
 *   + Prime       — bumps primeCount (only when buildCount > primeCount).
 *   Advance slot  — marks the active slot's steps all done + advances
 *                   the active-slot URL param to the next undone slot.
 *
 * Solid-fill Button variants only — success for the constructive
 * counter bumps, warning for the lateral "advance" move. Cyan is
 * deliberately avoided per the action-button colour ban.
 */
export function FocusQuickActions({
  projectId,
  activeSlotId,
  canPrime,
  slotParamKey = "focusSlot",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const writeSlotParam = (slotId: string | null) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (slotId) next.set(slotParamKey, slotId);
    else next.delete(slotParamKey);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const bump = (stage: "paint" | "prime") => {
    setError(null);
    startTransition(async () => {
      const res = await bumpCounter({ projectId, stage, delta: 1 });
      if (!res.ok) setError(res.error);
    });
  };

  const advance = () => {
    if (!activeSlotId) return;
    setError(null);
    startTransition(async () => {
      const res = await advanceSlot({ zoneId: activeSlotId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      writeSlotParam(res.data.nextSlotId);
    });
  };

  return (
    <div className="space-y-1">
      <div
        className={clsx(
          "flex flex-wrap items-center gap-2",
          pending && "opacity-80",
        )}
        aria-label="FOCUS quick actions"
        role="group"
      >
        <Button
          type="button"
          variant="success"
          size="sm"
          onClick={() => bump("paint")}
          disabled={pending}
          data-action="bump-paint"
        >
          + Paint
        </Button>
        {canPrime ? (
          <Button
            type="button"
            variant="success"
            size="sm"
            tone="outline"
            onClick={() => bump("prime")}
            disabled={pending}
            data-action="bump-prime"
          >
            + Prime
          </Button>
        ) : null}
        <Button
          type="button"
          variant="warning"
          size="sm"
          onClick={advance}
          disabled={pending || !activeSlotId}
          data-action="advance-slot"
        >
          Advance slot
        </Button>
      </div>
      {error ? (
        <p
          className="font-mono text-2xs uppercase tracking-wider text-[var(--color-red)]"
          role="status"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
