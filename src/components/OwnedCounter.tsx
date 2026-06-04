"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { bumpCounter } from "@/lib/actions/counters";
import { validateBump } from "@/lib/counters/cascade";
import { CounterButton } from "@/components/StageCounter";
import { useRosterPublisher } from "@/components/projects/RosterContext";

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
 *
 * P13.5 — Optimistic updates land instantly; the server confirms in
 * the background via `startTransition`. Buttons stay clickable during
 * the round-trip so rapid +/- holds keep registering — only the
 * cascade bounds (count ceiling, build floor) gate the next bump,
 * not network state. Mirror of the StageCounter rapid-click discipline.
 */
export function OwnedCounter({ snapshot }: { snapshot: OwnedSnapshot }) {
  const [snap, setSnap] = useState<OwnedSnapshot>(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep a ref to the latest optimistic value so rapid clicks stack
  // off the most-recent local state rather than the snapshot that was
  // captured when the previous click started its transition.
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  useEffect(() => {
    setSnap(snapshot);
    snapRef.current = snapshot;
  }, [snapshot]);

  // v6-4 bug fix — publish the optimistic OWNED count so the StageCounter
  // (a separate card) validates the BUILD cascade against the live roster.
  // Without this, assigning a stage right after filling the roster failed
  // with "Build can't exceed Owned (0)" until the server round-trip landed.
  const { publishOwned, clearOwned } = useRosterPublisher();
  useEffect(() => {
    publishOwned(snap.id, snap.ownedCount);
  }, [snap.id, snap.ownedCount, publishOwned]);
  useEffect(() => {
    return () => clearOwned(snapshot.id);
  }, [clearOwned, snapshot.id]);

  const onBump = useCallback((delta: 1 | -1) => {
    const current = snapRef.current;
    // Use the shared validateBump from counters.ts. For stage="owned"
    // the helper only reads `count` (upper) and `buildCount` (lower);
    // the other stages aren't part of owned's bounds, so passing
    // zeros keeps the type happy without affecting validation.
    const check = validateBump(
      {
        count: current.count,
        ownedCount: current.ownedCount,
        buildCount: current.buildCount,
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

    const prev = current;
    const optimistic = { ...prev, ownedCount: check.nextValue };
    setSnap(optimistic);
    snapRef.current = optimistic;

    startTransition(async () => {
      const result = await bumpCounter({
        projectId: current.id,
        stage: "owned",
        delta,
      });
      if (!result.ok) {
        setSnap(prev);
        snapRef.current = prev;
        setError(result.error);
      }
    });
  }, []);

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
            disabled={!canDecrement}
            onClick={() => onBump(-1)}
          />
          <CounterButton
            label="Increment owned"
            glyph="+"
            disabled={!canIncrement}
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
