"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
import { loadPaints } from "@/lib/paints/loader";
import { toPaint } from "@/lib/viewmodel/paint";
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
}: {
  children: ReactNode;
  variant?: "populated" | "empty";
  signedIn?: boolean;
}) {
  const [state] = useState(variant === "empty" ? empty : populated);
  const value = useMemo(() => ({ ...state, signedIn }), [state, signedIn]);
  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMockData() {
  return useContext(MockContext);
}

/* ----------------------------------------------------------------------------
 * Real data provider — the production replacement for MockProvider.
 * The server assembles user-scoped data (`AppServerData`, via loadAppData) and
 * passes it in; the heavy paint catalog loads client-side through the existing
 * Dexie read-through cache and is merged with the painter's inventory flags.
 * Pages keep reading the same `useMockData()` hook — same shape, real data.
 * ------------------------------------------------------------------------- */

export interface AppServerData {
  data: Omit<MockData, "paints">;
  inventory: Record<string, { ownedCount: number; isWishlisted: boolean }>;
}

export function AppDataProvider({
  server,
  children,
}: {
  server: AppServerData;
  children: ReactNode;
}) {
  const [paints, setPaints] = useState<Paint[]>([]);

  useEffect(() => {
    let alive = true;
    loadPaints()
      .then((catalog) => {
        if (!alive) return;
        setPaints(catalog.map((p) => toPaint(p, server.inventory[p.id])));
      })
      .catch(() => {
        // Catalog unavailable offline / pre-cache — render with an empty
        // library; the UI already handles the empty state.
        if (alive) setPaints([]);
      });
    return () => {
      alive = false;
    };
  }, [server.inventory]);

  const value = useMemo<MockData>(
    () => ({ ...server.data, paints }),
    [server.data, paints],
  );

  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}
