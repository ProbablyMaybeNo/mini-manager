"use client";

import { useEffect, useState, useTransition } from "react";
import { clsx } from "clsx";
import { bumpCounter } from "@/lib/actions/counters";
import { validateBump } from "@/lib/counters/cascade";
import { CounterButton } from "@/components/StageCounter";

/**
 * Slim snapshot — only the fields the owned row reads. Lets the
 * caller pass a typed projection and keep the StageCounter and
 * OwnedCounter snapshots independent.
 */
export type OwnedSnapshot = {
  id: string;
  count: number;
  ownedCount: number;
  buildCount: number;
};

/**
 * "Owned" sits between `count` (planned roster size) and the five
 * hobby stages. It represents minis you actually have on the desk
 * — minis you've bought or that arrived from the printer. Cascade:
 *   0 ≤ ownedCount ≤ count
 *   ownedCount ≥ buildCount   (lowering owned below build fails)
 */
export function OwnedCounter({ snapshot }: { snapshot: OwnedSnapshot }) {
  const [snap, setSnap] = useState<OwnedSnapshot>(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSnap(snapshot);
  }, [snapshot]);

  const onBump = (delta: 1 | -1) => {
    // Use the shared validateBump from counters.ts. Owned uses
    // count as its ceiling and buildCount as its floor — which is
    // exactly what the helper already encodes for stage="owned".
    const check = validateBump(
      {
        // The helper reads paint/prime/base/complete only for stages
        // below build; for "owned" it only inspects count + build.
        // Pass zeros for the unused fields to satisfy the type.
        count: snap.count,
        ownedCount: snap.ownedCount,
        buildCount: snap.buildCount,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
      },
      "owned",
      delta,
    );
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);

    const prev = snap;
    setSnap({ ...prev, ownedCount: check.nextValue });

    startTransition(async () => {
      const result = await bumpCounter({
        projectId: snap.id,
        stage: "owned",
        delta,
      });
      if (!result.ok) {
        setSnap(prev);
        setError(result.error);
      }
    });
  };

  if (snap.count === 0) {
    // The stage panel renders the empty-state message; owned has
    // nothing meaningful to show in that case.
    return null;
  }

  const canIncrement = snap.ownedCount < snap.count;
  const canDecrement = snap.ownedCount > snap.buildCount;
  const isLead = snap.ownedCount > 0;

  return (
    <div className="space-y-2">
      <div
        className={clsx(
          "frame px-3 py-2 grid items-center gap-x-3 gap-y-2",
          "grid-cols-[5rem_1fr_auto] sm:grid-cols-[5rem_1fr_auto_auto]",
        )}
      >
        <span
          className={clsx(
            "font-mono text-xs uppercase tracking-wider",
            isLead
              ? "text-[var(--color-amber)]"
              : "text-[var(--color-fg-muted)]",
          )}
        >
          OWNED
        </span>

        <span className="min-w-0 flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--color-fg-muted)] whitespace-nowrap">
            {snap.ownedCount} / {snap.count}
          </span>
          <span className="font-mono text-2xs text-[var(--color-fg-subtle)] uppercase tracking-wider hidden md:inline">
            minis on the desk
          </span>
        </span>

        <span className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
          <CounterButton
            label="Decrement owned"
            glyph="−"
            disabled={!canDecrement || isPending}
            onClick={() => onBump(-1)}
          />
          <CounterButton
            label="Increment owned"
            glyph="+"
            disabled={!canIncrement || isPending}
            onClick={() => onBump(1)}
          />
        </span>
      </div>

      {error ? (
        <p
          role="alert"
          className="frame px-3 py-2 text-xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
