"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * v6-4 bug fix — shared live roster (OWNED) count.
 *
 * The "Roster" card (OwnedCounter) and the "Stages" card (StageCounter)
 * are separate client components with independent optimistic state. The
 * OwnedCounter owns the OWNED tier; the StageCounter owns BUILD..DONE and
 * validates BUILD's cascade ceiling against OWNED. When the painter fills
 * the roster (OWNED → 10) in one card and immediately assigns the BUILD
 * stage in the other, the StageCounter's `ownedCount` is still the
 * pre-bump server value (0) — it only refreshes once the revalidatePath
 * round-trip re-renders the page. The cascade therefore rejected the
 * bump with "Build can't exceed Owned (0)", which read to the painter as
 * "no models in the roster" even though they'd just added ten.
 *
 * This context lets the OwnedCounter publish its optimistic OWNED value
 * the instant it changes, and the StageCounter reads it (falling back to
 * its own server snapshot) so its cascade validation + display reflect
 * the live roster immediately. The server render stays the source of
 * truth: when revalidation lands, both cards re-sync to the fresh
 * snapshot and the published value re-converges, so it can never drift.
 */

interface RosterState {
  ownedByProject: ReadonlyMap<string, number>;
  publishOwned: (projectId: string, ownedCount: number) => void;
  clearOwned: (projectId: string) => void;
}

const RosterContext = createContext<RosterState | null>(null);

export function RosterProvider({ children }: { children: ReactNode }) {
  const [ownedByProject, setOwnedByProject] = useState<
    ReadonlyMap<string, number>
  >(new Map());

  const publishOwned = useCallback((projectId: string, ownedCount: number) => {
    setOwnedByProject((prev) => {
      if (prev.get(projectId) === ownedCount) return prev;
      const next = new Map(prev);
      next.set(projectId, ownedCount);
      return next;
    });
  }, []);

  const clearOwned = useCallback((projectId: string) => {
    setOwnedByProject((prev) => {
      if (!prev.has(projectId)) return prev;
      const next = new Map(prev);
      next.delete(projectId);
      return next;
    });
  }, []);

  const value = useMemo<RosterState>(
    () => ({ ownedByProject, publishOwned, clearOwned }),
    [ownedByProject, publishOwned, clearOwned],
  );

  return (
    <RosterContext.Provider value={value}>{children}</RosterContext.Provider>
  );
}

/**
 * Live OWNED count for a project, falling back to `serverOwned` when no
 * optimistic value is published (no provider, or the OwnedCounter hasn't
 * bumped yet). Safe outside a provider — returns the fallback.
 */
export function useLiveOwnedCount(
  projectId: string,
  serverOwned: number,
): number {
  const ctx = useContext(RosterContext);
  if (!ctx) return serverOwned;
  const live = ctx.ownedByProject.get(projectId);
  return live ?? serverOwned;
}

/** Publisher handle for the OwnedCounter. No-ops outside a provider. */
export function useRosterPublisher(): {
  publishOwned: (projectId: string, ownedCount: number) => void;
  clearOwned: (projectId: string) => void;
} {
  const ctx = useContext(RosterContext);
  if (!ctx) {
    return { publishOwned: () => {}, clearOwned: () => {} };
  }
  return { publishOwned: ctx.publishOwned, clearOwned: ctx.clearOwned };
}
