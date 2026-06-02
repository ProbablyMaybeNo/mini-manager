"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { setStepCompletion } from "@/lib/actions/stepCompletion";

interface Props {
  stepId: string;
  done: boolean;
  /** Accessible label — the zone name + step number so the checkbox
   *  reads cleanly to a screen reader. */
  label: string;
}

/**
 * P15.0 — Per-step done checkbox for the active slot.
 *
 * Optimistic: flips the local checked state immediately, then persists
 * via `setStepCompletion`. On failure it reverts + surfaces the error.
 * The done-state is per-painter (the action keys on the current user),
 * so two painters sharing a recipe each track their own progress.
 */
export function StepCompletionCheckbox({ stepId, done, label }: Props) {
  const [checked, setChecked] = useState(done);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !checked;
    setChecked(next); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await setStepCompletion({ stepId, done: next });
      if (!res.ok) {
        setChecked(!next); // revert
        setError(res.error);
      }
    });
  };

  return (
    <label
      className={clsx(
        // P15.2 — the visual checkbox is 20px; without padding the touch
        // target was just the box. tap-target + justify-center expands the
        // hit area to 44px (mobile) / 32px (desktop) around the 20px box —
        // the painter ticks steps at the bench with a fingertip, not a
        // cursor, so this is a primary FOCUS-companion touch surface.
        "tap-target inline-flex items-center justify-center cursor-pointer select-none shrink-0",
        pending && "opacity-70",
      )}
      title={error ?? undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
        aria-label={label}
        className={clsx(
          "w-5 h-5 rounded-sm cursor-pointer",
          "accent-[var(--color-green)]",
          "border-2 border-[var(--color-border-strong)]",
        )}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {error ?? (checked ? "Step done" : "Step not done")}
      </span>
    </label>
  );
}
