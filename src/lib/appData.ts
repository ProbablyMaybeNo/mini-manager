import "server-only";
import { listInventoryByUser } from "@/db/queries/inventory";
import { listAllProjects } from "@/db/queries/projects";
import {
  getProjectPalettesMap,
  getPaintMetaMap,
  getRecipeWithSlots,
  listRecipesForTable,
} from "@/db/queries/recipes";
import { techniqueLabel } from "@/lib/recipes/techniqueLabel";
import {
  listPaintCollection,
  listModelCollection,
} from "@/db/queries/collections";
import { getRecentActivity, getActivityByDay } from "@/db/queries/activityLog";
import { listUpcomingEvents } from "@/db/queries/events";
import {
  getSessionRollups,
  getAllTimeRollupSeconds,
} from "@/db/queries/paintSessions";
import { displayStatus, progressPercent } from "@/lib/progress";
import { computeStreak } from "@/lib/streak";
import type {
  Project as DbProject,
  ActivityLogKind,
  WishlistItem,
} from "@/db/schema";
import type { MockData } from "@/mock/MockProvider";
import type {
  ActivityEntry,
  CalendarEvent,
  CollectionItem,
  Priority,
  Project as KitProject,
  ProjectStatus,
  ProjectType as KitProjectType,
  Recipe as KitRecipe,
  SessionStats,
} from "@/lib/types";

/** Load one recipe (with its real slots resolved to swatch + label) for the
 *  editor, so saving preserves catalog paint links + layer/technique. */
export async function loadEditorRecipe(
  userId: string,
  recipeId: string,
): Promise<KitRecipe | null> {
  const [bundle, paintMeta] = await Promise.all([
    getRecipeWithSlots(userId, recipeId),
    getPaintMetaMap(),
  ]);
  if (!bundle) return null;
  return {
    id: bundle.id,
    name: bundle.name,
    slots: bundle.slots.map((s) => {
      const meta = s.paintId ? paintMeta.get(s.paintId) : null;
      const hex = meta?.hex ?? s.customColorHex ?? "#888888";
      return {
        paintId: s.paintId ?? "",
        swatch: hex,
        brand: "",
        name: meta?.label ?? hex,
        layer: techniqueLabel(s.technique),
        note: s.notesMd ?? undefined,
      };
    }),
    inspoLinks: [],
    assignedProjectId: bundle.attachedProjectId ?? undefined,
    notes: bundle.notesMd ?? undefined,
  };
}

/** All of the user's projects mapped to the kit shape (for the editor's
 *  attach-to-project picker; swatches aren't needed there). */
export async function loadProjectsForPicker(
  userId: string,
): Promise<KitProject[]> {
  const projects = await listAllProjects(userId);
  return projects.map((p) => mapProject(p, []));
}

/** The signed-in user's owned / wishlisted paint ids — the small,
 *  serializable slice the Library route sends to the client, which loads the
 *  catalog itself (static asset) and merges these flags in. */
export interface InventoryFlags {
  ownedIds: string[];
  wishlistedIds: string[];
}

export async function loadInventoryFlags(
  userId: string | null,
): Promise<InventoryFlags> {
  if (!userId) return { ownedIds: [], wishlistedIds: [] };
  const inventory = await listInventoryByUser(userId);
  const ownedIds: string[] = [];
  const wishlistedIds: string[] = [];
  for (const [paintId, entry] of inventory) {
    if (entry.ownedCount > 0) ownedIds.push(paintId);
    if (entry.isWishlisted) wishlistedIds.push(paintId);
  }
  return { ownedIds, wishlistedIds };
}

/**
 * APP-DATA — the real-backend implementation of the kit's data seam.
 *
 * Maps the production DB queries onto the rebuild's typed view-models
 * (src/lib/types.ts) so `useMockData()` (renamed conceptually to the app
 * data provider) serves real, owner-scoped data without touching a single
 * presentational component. Returns a Partial<MockData>; the provider
 * merges it over the populated fixtures, so any field not wired yet falls
 * back to the mock until its loader lands.
 */

/** DB priority (Urgent/High/Medium/Low) → kit Priority (Low/Med/High). */
const PRIORITY_MAP: Record<string, Priority> = {
  Urgent: "High",
  High: "High",
  Medium: "Med",
  Low: "Low",
};

/** DB project type → kit ProjectType (collapses the two extra DB types). */
const TYPE_MAP: Record<string, KitProjectType> = {
  Army: "Army",
  Warband: "Warband",
  Unit: "Unit",
  Model: "Model",
  "Terrain Piece": "Terrain",
  Diorama: "Terrain",
};

function mapProject(p: DbProject, swatches: string[]): KitProject {
  return {
    id: p.id,
    title: p.name,
    type: TYPE_MAP[p.type] ?? "Unit",
    recipeSwatches: swatches,
    status: displayStatus(p),
    priority: PRIORITY_MAP[p.priority ?? "Medium"] ?? "Med",
    completionPercent: progressPercent(p),
  };
}

/** ms-epoch / Date → ISO calendar day (YYYY-MM-DD, UTC). */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Activity kind → the kit ActivityFeed icon key (add/cart/build/prime/paint/check). */
const ACTIVITY_ICON: Record<ActivityLogKind, string> = {
  project_created: "add",
  recipe_created: "check",
  paint_added: "cart",
  slot_added: "add",
  stage_bump: "build",
  paint_session: "paint",
};

function activitySentence(row: {
  kind: ActivityLogKind;
  displayName: string | null;
  parentRecipeName: string | null;
}): string {
  const name = row.displayName;
  switch (row.kind) {
    case "stage_bump":
      return name ? `Bumped ${name}` : "Bumped a project";
    case "recipe_created":
      return name ? `Created recipe ${name}` : "Created a recipe";
    case "project_created":
      return name ? `Created project ${name}` : "Created a project";
    case "paint_added":
      return name ? `Added paint to ${name}` : "Bought paint";
    case "slot_added":
      return `Added slot to ${row.parentRecipeName ?? name ?? "a recipe"}`;
    case "paint_session":
      return "Logged a painting session";
  }
}

/** Map a RecipeTableRow onto the kit's Recipe view-model. The index only
 *  renders name + swatch strip + attached project, so slots carry the
 *  palette hex/label (paintId/brand/layer aren't surfaced on the index). */
function mapRecipe(row: {
  id: string;
  name: string;
  attachedProjectId: string | null;
  palette: { hex: string; label: string }[];
  publicSlug: string | null;
}): KitRecipe {
  return {
    id: row.id,
    name: row.name,
    slots: row.palette.map((p) => ({
      paintId: "",
      swatch: p.hex,
      brand: "",
      name: p.label,
      layer: "",
    })),
    inspoLinks: [],
    assignedProjectId: row.attachedProjectId ?? undefined,
    shareUrl: row.publicSlug ? `/r/${row.publicSlug}` : undefined,
  };
}

/** DB wishlist status → kit ProjectStatus (collection rows reuse the
 *  project-stage lifecycle for their status pill). */
const COLLECTION_STATUS_MAP: Record<string, ProjectStatus> = {
  WISHLIST: "WISHLIST",
  OWNED: "OWNED",
  HOLD: "SHELVED",
  BUILT: "BUILDING",
  PRIMED: "PRIMING",
  PAINTED: "PAINTING",
  BASED: "BASING",
  COMPLETE: "COMPLETE",
  PURCHASED: "OWNED",
};

function mapCollectionItem(i: WishlistItem): CollectionItem {
  return {
    id: i.id,
    kind: i.kind,
    thumbnail: i.imageUrl ?? "",
    name: i.title,
    company: i.company ?? i.army ?? i.game ?? "",
    vendor: i.vendor ?? "",
    price: i.price != null ? `$${(i.price / 100).toFixed(2)}` : "",
    status: COLLECTION_STATUS_MAP[i.status ?? "WISHLIST"] ?? "OWNED",
    sourceUrl: i.sourceUrl ?? "",
    projectId: i.projectId ?? undefined,
  };
}

/** Short relative time ("<1m", "12m", "3h", "2d") for the activity column. */
function relativeWhen(then: Date, now: Date): string {
  const ms = now.getTime() - then.getTime();
  if (ms < 60_000) return "<1m";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Load the owner-scoped slice of MockData the dashboard and its rail
 * render. recipes / collection / paints / matchResults are intentionally
 * omitted here — they fall through to the fixtures until their loaders are
 * wired in a later phase.
 */
export async function loadAppData(userId: string): Promise<Partial<MockData>> {
  const now = new Date();
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  const [
    projects,
    palettes,
    recipeRows,
    collectionPaints,
    collectionModels,
    activityRows,
    events,
    rollups,
    allTimeSeconds,
    activityDays,
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    listRecipesForTable(userId),
    listPaintCollection(userId),
    listModelCollection(userId),
    getRecentActivity(userId, 20),
    listUpcomingEvents(userId, startOfUtcDay(now), 8),
    getSessionRollups(userId, now.getTime()),
    getAllTimeRollupSeconds(userId),
    getActivityByDay(userId, new Date(now.getTime() - SIXTY_DAYS_MS)),
  ]);

  const sessionStats: SessionStats = {
    todayMinutes: Math.round(rollups.todaySeconds / 60),
    weekMinutes: Math.round(rollups.weekSeconds / 60),
    allTimeMinutes: Math.round(allTimeSeconds / 60),
    streakDays: computeStreak(activityDays, now).streak,
  };

  const mappedActivity: ActivityEntry[] = activityRows.map((row) => ({
    id: row.id,
    icon: ACTIVITY_ICON[row.kind] ?? "check",
    text: activitySentence(row),
    when: relativeWhen(row.createdAt, now),
  }));

  const mappedEvents: CalendarEvent[] = events.map((e) => ({
    id: e.id,
    date: isoDay(e.eventDate),
    name: e.name,
    kind: e.kind,
  }));

  return {
    signedIn: true,
    projects: projects.map((p) => mapProject(p, palettes.get(p.id) ?? [])),
    recipes: recipeRows.map(mapRecipe),
    collectionPaints: collectionPaints.map(mapCollectionItem),
    collectionModels: collectionModels.map(mapCollectionItem),
    events: mappedEvents,
    activity: mappedActivity,
    sessionStats,
  };
}
