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
  /** Real, server-loaded data merged over the fixtures. Any field omitted
   *  falls back to the mock, so pages light up as their loaders land
   *  (src/lib/appData.ts). When undefined, pure fixtures render. */
  data?: Partial<MockData>;
}) {
  const [base] = useState(variant === "empty" ? empty : populated);
  const value = useMemo(
    () => ({ ...base, ...data, signedIn }),
    [base, data, signedIn],
  );
  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMockData() {
  return useContext(MockContext);
}
