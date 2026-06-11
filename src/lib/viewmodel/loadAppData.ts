import "server-only";
import type { Project as DbProject } from "@/db/schema";
import { listAllProjects } from "@/db/queries/projects";
import {
  getProjectPalettesMap,
  getRecipeWithSlots,
  listAllRecipesGrouped,
  listInspoForRecipe,
} from "@/db/queries/recipes";
import { listUpcomingEvents } from "@/db/queries/events";
import { getActivityByDay, getRecentActivity } from "@/db/queries/activityLog";
import { getAllTimeRollupSeconds, getSessionRollups } from "@/db/queries/paintSessions";
import { listModelCollection, listPaintCollection } from "@/db/queries/collections";
import { getInventoryByPaintId } from "@/db/queries/paintCoverage";
import type { AppServerData } from "@/mock/MockProvider";
import type { Hex, Project } from "@/lib/types";
import { getCatalogById } from "./serverCatalog";
import { toProject } from "./project";
import { toRecipe } from "./recipe";
import { toCalendarEvent } from "./event";
import { toActivityEntry } from "./activity";
import { toCollectionItem } from "./collection";
import { streakFromDays, toSessionStats } from "./session";

const STREAK_LOOKBACK_DAYS = 90;

function buildProjectTree(
  all: ReadonlyArray<DbProject>,
  palettes: ReadonlyMap<string, ReadonlyArray<string>>,
): Project[] {
  const byParent = new Map<string | null, DbProject[]>();
  for (const p of all) {
    const list = byParent.get(p.parentId) ?? [];
    list.push(p);
    byParent.set(p.parentId, list);
  }

  const descendantsOf = (id: string): DbProject[] => {
    const kids = byParent.get(id) ?? [];
    return kids.flatMap((k) => [k, ...descendantsOf(k.id)]);
  };

  const toNode = (p: DbProject): Project =>
    toProject(p, {
      descendants: descendantsOf(p.id),
      swatches: [...(palettes.get(p.id) ?? [])] as Hex[],
      children: (byParent.get(p.id) ?? []).map(toNode),
    });

  return (byParent.get(null) ?? []).map(toNode);
}

/** Assemble the full signed-in view-model (minus the client-loaded catalog). */
export async function loadAppData(userId: string): Promise<AppServerData> {
  const now = new Date();
  const since = new Date(now.getTime() - STREAK_LOOKBACK_DAYS * 86_400_000);

  const [
    dbProjects,
    palettes,
    grouped,
    catalogById,
    upcoming,
    activityRows,
    activityDays,
    rollups,
    allTimeSeconds,
    paintItems,
    modelItems,
    inventory,
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    listAllRecipesGrouped(userId),
    getCatalogById(),
    listUpcomingEvents(userId, now, 8),
    getRecentActivity(userId, 20),
    getActivityByDay(userId, since),
    getSessionRollups(userId),
    getAllTimeRollupSeconds(userId),
    listPaintCollection(userId),
    listModelCollection(userId),
    getInventoryByPaintId(userId),
  ]);

  const recipeRows = [
    ...grouped.standalone,
    ...grouped.byProject.flatMap((g) => g.recipes),
  ];
  const recipes = await Promise.all(
    recipeRows.map(async (r) => {
      const [full, inspo] = await Promise.all([
        getRecipeWithSlots(userId, r.id),
        listInspoForRecipe(r.id),
      ]);
      const withSlots = full ?? { ...r, slots: [] };
      return toRecipe(withSlots, inspo.map((i) => i.url), catalogById);
    }),
  );

  const nowMs = now.getTime();
  const inventoryRecord: Record<string, { ownedCount: number; isWishlisted: boolean }> = {};
  for (const [paintId, entry] of inventory) {
    inventoryRecord[paintId] = {
      ownedCount: entry.ownedCount,
      isWishlisted: entry.isWishlisted,
    };
  }

  return {
    data: {
      signedIn: true,
      projects: buildProjectTree(dbProjects, palettes),
      recipes,
      activity: activityRows.map((a) => toActivityEntry(a, nowMs)),
      events: upcoming.map(toCalendarEvent),
      sessionStats: toSessionStats({
        todaySeconds: rollups.todaySeconds,
        weekSeconds: rollups.weekSeconds,
        allTimeSeconds: allTimeSeconds,
        streakDays: streakFromDays(activityDays, now),
      }),
      matchResults: [],
      collectionPaints: paintItems.map(toCollectionItem),
      collectionModels: modelItems.map(toCollectionItem),
    },
    inventory: inventoryRecord,
  };
}
