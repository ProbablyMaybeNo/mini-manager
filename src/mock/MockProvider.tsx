"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  ActivityEntry,
  CalendarEvent,
  CollectionItem,
  MatchResult,
  Paint,
  Project,
  Recipe,
  SessionStats,
} from "@/lib/types";
import * as fx from "./fixtures";

/**
 * The ONLY place mock fixtures meet the component tree. Swap this provider for the host's
 * data source later — the screens read the same shapes via `useMockData()`.
 */
export interface MockData {
  signedIn: boolean;
  projects: Project[];
  paints: Paint[];
  recipes: Recipe[];
  activity: ActivityEntry[];
  events: CalendarEvent[];
  sessionStats: SessionStats;
  /** Per-project lifetime logged minutes, keyed by project id (A5qzb —
   *  Focus per-project time). Absent ids have no logged time. */
  projectMinutes: Record<string, number>;
  matchResults: MatchResult[];
  collectionPaints: CollectionItem[];
  collectionModels: CollectionItem[];
}

const populated: MockData = {
  signedIn: true,
  projects: fx.mockProjects,
  paints: fx.mockLibrary,
  recipes: fx.mockRecipes,
  activity: fx.mockActivity,
  events: fx.mockEvents,
  sessionStats: fx.mockSessionStats,
  projectMinutes: fx.mockProjectMinutes,
  matchResults: fx.mockMatchResults,
  collectionPaints: fx.mockCollectionPaints,
  collectionModels: fx.mockCollectionModels,
};

const empty: MockData = {
  signedIn: true,
  projects: fx.emptyProjects,
  paints: fx.emptyPaints,
  recipes: fx.emptyRecipes,
  activity: fx.emptyActivity,
  events: fx.emptyEvents,
  sessionStats: fx.zeroSessionStats,
  projectMinutes: {},
  matchResults: fx.emptyMatchResults,
  collectionPaints: fx.emptyCollection,
  collectionModels: fx.emptyCollection,
};

const MockContext = createContext<MockData>(populated);

export function MockProvider({
  children,
  variant = "populated",
  signedIn = true,
  data,
}: {
  children: ReactNode;
  variant?: "populated" | "empty";
  signedIn?: boolean;
  /** Real, server-loaded data merged over the base. Any field omitted falls
   *  back to the base — which for a SIGNED-IN user is the empty set, not the
   *  populated fixtures (Ross, 2026-08-02). Routes now load only the slice
   *  they render, so "omitted" is the normal case rather than a page whose
   *  loader hasn't landed yet; falling back to `populated` there would put
   *  invented armies and recipes on a real user's screen. Empty is wrong in a
   *  way you can see; fabricated data is wrong in a way you can't. The
   *  signed-out preview still gets the full fixtures so the demo reads. */
  data?: Partial<MockData>;
}) {
  const [base] = useState(
    variant === "empty" || signedIn ? empty : populated,
  );
  const value = useMemo(
    () => ({ ...base, ...data, signedIn }),
    [base, data, signedIn],
  );
  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMockData() {
  return useContext(MockContext);
}
