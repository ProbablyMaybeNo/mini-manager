import "server-only";
import { cache } from "react";
import { listInventoryByUser } from "@/db/queries/inventory";
import { listLinkedPaintStatuses } from "@/lib/paints/reconcileOwnership";
import { listAllProjects } from "@/db/queries/projects";
import {
  getPaintMetaMap,
  getRecipeWithSlots,
  getRecipesByPaintId,
  listInspoForRecipe,
  loadDashboardRecipeBundle,
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
  getProjectRollupSecondsMap,
} from "@/db/queries/paintSessions";
import {
  aggregateCounters,
  displayStatus,
  progressPercent,
  type AggregateCounters,
} from "@/lib/progress";
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
  const [bundle, paintMeta, inspoRows] = await Promise.all([
    getRecipeWithSlots(userId, recipeId),
    getPaintMetaMap(),
    listInspoForRecipe(recipeId),
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
    inspo: inspoRows.map((r) => ({ id: r.id, url: r.url, imageUrl: r.imageUrl })),
    assignedProjectId: bundle.attachedProjectId ?? undefined,
    notes: bundle.notesMd ?? undefined,
  };
}

/** All of the user's projects mapped to the kit shape (for the editor's
 *  attach-to-project picker; swatches aren't needed there). */
export async function loadProjectsForPicker(
  userId: string,
): Promise<KitProject[]> {
  // Flat list (no tree) — the picker only needs name + swatches, so aggregate
  // over the project's own counters.
  const projects = await listAllProjects(userId);
  return projects.map((p) => mapProject(p, [], aggregateCounters(p, [])));
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
  // Library ↔ Collection sync — a paint reads as OWNED/WISHLIST if EITHER
  // store says so: inventory_entry (the fast flag, ~8 other call sites)
  // OR its linked Collection row's status (a row the backfill script
  // links, or one edited straight on /collection, may be ahead of
  // inventory_entry until the next reconcile write touches it).
  const [inventory, linked] = await Promise.all([
    listInventoryByUser(userId),
    listLinkedPaintStatuses(userId),
  ]);
  const ownedIds = new Set<string>();
  const wishlistedIds = new Set<string>();
  for (const [paintId, entry] of inventory) {
    if (entry.ownedCount > 0) ownedIds.add(paintId);
    if (entry.isWishlisted) wishlistedIds.add(paintId);
  }
  for (const [paintId, status] of linked) {
    if (status === "OWNED") ownedIds.add(paintId);
    if (status === "WISHLIST") wishlistedIds.add(paintId);
  }
  return { ownedIds: [...ownedIds], wishlistedIds: [...wishlistedIds] };
}

/** Serializable `paintId -> recipes[]` map for the Library paint panel's
 *  RECIPE chips — the small owner-scoped slice the client merges onto the
 *  static catalog it loads itself. */
export async function loadRecipesByPaintId(
  userId: string | null,
): Promise<Record<string, { id: string; name: string }[]>> {
  if (!userId) return {};
  const map = await getRecipesByPaintId(userId);
  return Object.fromEntries(map);
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

function mapProject(p: DbProject, swatches: string[], agg: AggregateCounters): KitProject {
  return {
    id: p.id,
    title: p.name,
    type: TYPE_MAP[p.type] ?? "Unit",
    recipeSwatches: swatches,
    status: displayStatus(p),
    priority: PRIORITY_MAP[p.priority ?? "Medium"] ?? "Med",
    // Roll-up: a container's completion + model totals aggregate its own AND
    // all descendant counters, so painting a unit's models fills the army's
    // bar too (Ross — "watch the army fill in green"). For a leaf, `agg` equals
    // its own counters, so units/models are unchanged.
    completionPercent: progressPercent(agg),
    modelCount: agg.count,
    modelsComplete: agg.completeCount,
  };
}

/**
 * Nest the flat project list into the kit's parent → children tree using
 * `parentId`. Only top-level rows are returned; each carries its sub-projects
 * under `children`, recursively (Army → Unit → Model). A child whose parent
 * isn't in the list (e.g. an archived parent) is surfaced as a root so it's
 * never silently dropped. Order within a tier follows the query order.
 */
function buildProjectTree(
  rows: ReadonlyArray<DbProject>,
  palettes: Map<string, string[]>,
): KitProject[] {
  // Index children by parent so each node can aggregate its whole subtree.
  const childrenByParent = new Map<string, DbProject[]>();
  for (const p of rows) {
    if (!p.parentId) continue;
    const arr = childrenByParent.get(p.parentId);
    if (arr) arr.push(p);
    else childrenByParent.set(p.parentId, [p]);
  }
  const descendantsOf = (id: string): DbProject[] => {
    const out: DbProject[] = [];
    const stack = [...(childrenByParent.get(id) ?? [])];
    while (stack.length) {
      const c = stack.pop()!;
      out.push(c);
      const kids = childrenByParent.get(c.id);
      if (kids) stack.push(...kids);
    }
    return out;
  };

  const nodes = new Map<string, KitProject>();
  for (const p of rows) {
    const agg = aggregateCounters(p, descendantsOf(p.id));
    nodes.set(p.id, mapProject(p, palettes.get(p.id) ?? [], agg));
  }
  const roots: KitProject[] = [];
  for (const p of rows) {
    const node = nodes.get(p.id)!;
    const parent = p.parentId ? nodes.get(p.parentId) : undefined;
    if (parent) {
      (parent.children ??= []).push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** ms-epoch / Date → ISO calendar day (YYYY-MM-DD, UTC). */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** First ms of the current UTC month — the dashboard calendar's lower bound so
 *  an event added earlier *this* month (e.g. a near-term deadline) still draws
 *  its dot on the grid (d9cfJYAVIx0C). Fetching from start-of-today instead hid
 *  any same-month event whose day had already passed. */
function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
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

/**
 * Map a RecipeTableRow onto the kit's Recipe view-model.
 *
 * Reads `row.slots` (the rich per-slot shape) rather than `row.palette`, so
 * the technique label and the recipe's notes survive. This list is what the
 * FOCUS bench renders from, and dropping those two fields is why the bench
 * showed unlabelled colour cards and a permanent "No notes yet" even on a
 * recipe that had both (Ross, 2026-07-27). `palette` is the fallback for the
 * rare slot the rich builder skips (a slot whose paintId isn't in the catalog).
 */
function mapRecipe(
  row: {
    id: string;
    name: string;
    attachedProjectId: string | null;
    palette: { hex: string; label: string }[];
    slots: { hex: string; paintLabel: string | null; layerLabel: string }[];
    notesMd: string | null;
    publicSlug: string | null;
  },
  inspo: { id: string; url: string; imageUrl: string | null }[],
): KitRecipe {
  const slots =
    row.slots.length > 0
      ? row.slots.map((s) => ({
          paintId: "",
          swatch: s.hex,
          brand: "",
          name: s.paintLabel ?? s.hex,
          layer: s.layerLabel,
        }))
      : row.palette.map((p) => ({
          paintId: "",
          swatch: p.hex,
          brand: "",
          name: p.label,
          layer: "",
        }));
  return {
    id: row.id,
    name: row.name,
    slots,
    inspo,
    assignedProjectId: row.attachedProjectId ?? undefined,
    notes: row.notesMd ?? undefined,
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
    company: i.company ?? "",
    vendor: i.vendor ?? "",
    game: i.game ?? undefined,
    army: i.army ?? undefined,
    price: i.price != null ? `$${(i.price / 100).toFixed(2)}` : "",
    status: COLLECTION_STATUS_MAP[i.status ?? "WISHLIST"] ?? "OWNED",
    sourceUrl: i.sourceUrl ?? "",
    projectId: i.projectId ?? undefined,
    recipeId: i.recipeId ?? undefined,
    paintType: i.paintType ?? undefined,
    paintId: i.paintId ?? undefined,
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
 *
 * Wrapped in React `cache()` so the layout (which feeds MockProvider) and the
 * page (e.g. the dashboard) share ONE execution per request instead of running
 * the whole 12-query batch twice against the remote DB.
 */
export const loadAppData = cache(async (userId: string): Promise<Partial<MockData>> => {
  const now = new Date();
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  const [
    projects,
    recipeBundle,
    activityRows,
    events,
    rollups,
    allTimeSeconds,
    activityDays,
    projectSecondsMap,
  ] = await Promise.all([
    listAllProjects(userId),
    // One combined read of recipe/recipe_slot/recipe_inspo (P5) — replaces the
    // three separate calls that each re-read the recipe table.
    loadDashboardRecipeBundle(userId),
    getRecentActivity(userId, 20),
    // From the first of the current month (not today) so a deadline added
    // earlier this month still renders on the calendar grid (d9cfJYAVIx0C);
    // larger limit so a busy month isn't truncated before its later events.
    listUpcomingEvents(userId, startOfUtcMonth(now), 24),
    getSessionRollups(userId, now.getTime()),
    getAllTimeRollupSeconds(userId),
    getActivityByDay(userId, new Date(now.getTime() - SIXTY_DAYS_MS)),
    getProjectRollupSecondsMap(userId),
  ]);
  const { recipeRows, palettesMap: palettes, inspoMap } = recipeBundle;

  const sessionStats: SessionStats = {
    todayMinutes: Math.round(rollups.todaySeconds / 60),
    weekMinutes: Math.round(rollups.weekSeconds / 60),
    allTimeMinutes: Math.round(allTimeSeconds / 60),
    streakDays: computeStreak(activityDays, now).streak,
  };

  const projectMinutes: Record<string, number> = {};
  for (const [projectId, seconds] of projectSecondsMap) {
    projectMinutes[projectId] = Math.round(seconds / 60);
  }

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
    notes: e.notes ?? null,
  }));

  return {
    signedIn: true,
    projects: buildProjectTree(projects, palettes),
    recipes: recipeRows.map((r) => mapRecipe(r, inspoMap.get(r.id) ?? [])),
    events: mappedEvents,
    activity: mappedActivity,
    sessionStats,
    projectMinutes,
  };
});

/**
 * The COLLECTION page's own data (Ross, 2026-08-02 — "speed up the website").
 *
 * These two lists used to ride in `loadAppData`, which the signed-in layout
 * calls on EVERY route and injects into MockProvider. One paint row is small;
 * a real collection is hundreds of them, and they were serialized into the RSC
 * payload of every page and of every server action's re-render — including the
 * project page, where nothing renders a collection. Loading them here means
 * only the one route that shows them pays for them.
 */
export const loadCollectionData = cache(
  async (
    userId: string,
  ): Promise<{ collectionPaints: CollectionItem[]; collectionModels: CollectionItem[] }> => {
    const [paints, models] = await Promise.all([
      listPaintCollection(userId),
      listModelCollection(userId),
    ]);
    return {
      collectionPaints: paints.map(mapCollectionItem),
      collectionModels: models.map(mapCollectionItem),
    };
  },
);
