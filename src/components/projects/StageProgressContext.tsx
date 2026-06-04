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
 * v6-4 bug fix — live header progress.
 *
 * The leaf-unit header progress bar (ProjectHeaderStrip) is server-
 * rendered from the page's `percent`, while the StageCounter below it
 * mutates stages OPTIMISTICALLY. The header bar therefore only caught up
 * once the server action's `revalidatePath` round-trip finished and the
 * whole page re-rendered — a long, noticeable lag, worst when the painter
 * had just ticked the last of a unit's stages and stared at a bar still
 * reading the old percent.
 *
 * This tiny context lets the StageCounter publish its optimistic percent
 * the instant a bump applies; the header bar subscribes and updates
 * immediately. The server render is still the source of truth: when
 * `revalidatePath` lands and the page re-renders with a fresh `percent`,
 * the header bar falls back to it (the optimistic value is cleared by the
 * StageCounter's own snapshot re-sync), so correctness is preserved and
 * the optimistic value can never drift from the server.
 */

interface StageProgressState {
  /** Optimistic percent published by the StageCounter, keyed by project
   *  id. Absent → the consumer uses its server `percent`. */
  percentByProject: ReadonlyMap<string, number>;
  publish: (projectId: string, percent: number) => void;
  clear: (projectId: string) => void;
}

const StageProgressContext = createContext<StageProgressState | null>(null);

export function StageProgressProvider({ children }: { children: ReactNode }) {
  const [percentByProject, setPercentByProject] = useState<
    ReadonlyMap<string, number>
  >(new Map());

  const publish = useCallback((projectId: string, percent: number) => {
    setPercentByProject((prev) => {
      if (prev.get(projectId) === percent) return prev;
      const next = new Map(prev);
      next.set(projectId, percent);
      return next;
    });
  }, []);

  const clear = useCallback((projectId: string) => {
    setPercentByProject((prev) => {
      if (!prev.has(projectId)) return prev;
      const next = new Map(prev);
      next.delete(projectId);
      return next;
    });
  }, []);

  const value = useMemo<StageProgressState>(
    () => ({ percentByProject, publish, clear }),
    [percentByProject, publish, clear],
  );

  return (
    <StageProgressContext.Provider value={value}>
      {children}
    </StageProgressContext.Provider>
  );
}

/**
 * Read the live progress percent for a project, falling back to the
 * server-rendered `serverPercent` when no optimistic value is published
 * (no provider mounted, or no StageCounter has bumped yet). Safe to call
 * outside a provider — it simply returns the server value.
 */
export function useLiveProgressPercent(
  projectId: string,
  serverPercent: number,
): number {
  const ctx = useContext(StageProgressContext);
  if (!ctx) return serverPercent;
  const live = ctx.percentByProject.get(projectId);
  return live ?? serverPercent;
}

/**
 * Publisher handle for the StageCounter. Returns no-op functions when no
 * provider is mounted so the counter stays portable.
 */
export function useStageProgressPublisher(): {
  publish: (projectId: string, percent: number) => void;
  clear: (projectId: string) => void;
} {
  const ctx = useContext(StageProgressContext);
  if (!ctx) {
    return { publish: () => {}, clear: () => {} };
  }
  return { publish: ctx.publish, clear: ctx.clear };
}
