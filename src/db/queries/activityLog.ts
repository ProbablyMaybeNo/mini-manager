import "server-only";

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activityLog,
  projects,
  recipes,
  recipeSlots,
  wishlistItems,
  type ActivityLogKind,
} from "@/db/schema";

/**
 * P14.4 — Shared activity_log query layer for the PLANNER widgets.
 *
 * Three sibling widgets read off `activity_log`:
 *
 *   - Activity stream (P14.4) — last 20 rows with display-name
 *     resolution for the row's `refId`.
 *   - Streak counter (P14.5) — derives consecutive-day count from
 *     stage_bump + recipe_created rows.
 *   - Heatmap (P14.6) — 90-day grid coloured by activity count per
 *     day.
 *
 * To avoid each widget re-doing the same work, the two queries below
 * are the single sources of truth. The activity widget consumes
 * `getRecentActivity`, streak + heatmap both consume
 * `getActivityByDay`.
 *
 * Both helpers are bounded by user_id + a LIMIT or time window so the
 * `activity_log_user_created_idx` BTree carries the read efficiently
 * even once the table runs to millions of rows.
 */

/* ============================================================
   getRecentActivity — for the activity stream widget
   ============================================================ */

/**
 * One resolved row of the activity stream. The `displayName` field is
 * populated when the row's `refId` points at an entity whose name we
 * can pull (projects.name / recipes.name / wishlistItems.title). For
 * rows where the refId is missing or points at a deleted entity, the
 * field is null and the widget renders generic microcopy.
 */
export interface ActivityStreamRow {
  id: string;
  kind: ActivityLogKind;
  refId: string | null;
  createdAt: Date;
  displayName: string | null;
  /** When the ref points at a recipe slot, this resolves the slot's
   *  parent recipe name (slot_added rows show "Added slot to <recipe
   *  name>"). null for non-slot refs. */
  parentRecipeName: string | null;
}

/**
 * Last N rows for the activity stream, newest first, with display
 * names eagerly resolved for the four ref shapes used today
 * (project / recipe / zone / wishlist item).
 *
 * Algorithm:
 *   1) Pull the N most-recent rows for this user (single indexed
 *      lookup).
 *   2) Group `refId`s by which target table they belong to (driven
 *      off the row's `kind`).
 *   3) Issue one `inArray` query per target table, then stitch the
 *      display name back onto each row.
 *
 * The function is intentionally tolerant of deleted refs — a refId
 * that no longer resolves just leaves `displayName: null`. The
 * widget then renders generic "Bumped a project" rather than blowing
 * up on the painter.
 */
export async function getRecentActivity(
  userId: string,
  limit = 20,
): Promise<ReadonlyArray<ActivityStreamRow>> {
  const rows = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.userId, userId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const projectIds = new Set<string>();
  const recipeIds = new Set<string>();
  const slotIds = new Set<string>();
  const wishlistIds = new Set<string>();

  for (const r of rows) {
    if (!r.refId) continue;
    switch (r.kind) {
      case "stage_bump":
      case "project_created":
        projectIds.add(r.refId);
        break;
      case "recipe_created":
        recipeIds.add(r.refId);
        break;
      case "slot_added":
        slotIds.add(r.refId);
        break;
      case "paint_added":
        wishlistIds.add(r.refId);
        break;
    }
  }

  const [projectRows, recipeRows, slotRows, wishlistRows] = await Promise.all([
    projectIds.size > 0
      ? db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(
            and(
              eq(projects.ownerId, userId),
              inArray(projects.id, [...projectIds]),
            ),
          )
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    recipeIds.size > 0
      ? db
          .select({ id: recipes.id, name: recipes.name })
          .from(recipes)
          .where(
            and(
              eq(recipes.ownerId, userId),
              inArray(recipes.id, [...recipeIds]),
            ),
          )
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    slotIds.size > 0
      ? db
          .select({
            id: recipeSlots.id,
            recipeName: recipes.name,
            recipeOwnerId: recipes.ownerId,
          })
          .from(recipeSlots)
          .innerJoin(recipes, eq(recipeSlots.recipeId, recipes.id))
          .where(
            and(
              eq(recipes.ownerId, userId),
              inArray(recipeSlots.id, [...slotIds]),
            ),
          )
      : Promise.resolve(
          [] as Array<{
            id: string;
            recipeName: string;
            recipeOwnerId: string;
          }>,
        ),
    wishlistIds.size > 0
      ? db
          .select({
            id: wishlistItems.id,
            title: wishlistItems.title,
            projectId: wishlistItems.projectId,
          })
          .from(wishlistItems)
          .where(
            and(
              eq(wishlistItems.ownerId, userId),
              inArray(wishlistItems.id, [...wishlistIds]),
            ),
          )
      : Promise.resolve(
          [] as Array<{
            id: string;
            title: string;
            projectId: string | null;
          }>,
        ),
  ]);

  const indirectProjectIds = new Set<string>();
  for (const w of wishlistRows) {
    if (w.projectId) indirectProjectIds.add(w.projectId);
  }
  const missingProjectIds = [...indirectProjectIds].filter(
    (id) => !projectRows.some((p) => p.id === id),
  );
  const extraProjectRows =
    missingProjectIds.length > 0
      ? await db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(
            and(
              eq(projects.ownerId, userId),
              inArray(projects.id, missingProjectIds),
            ),
          )
      : [];

  const projectNameById = new Map<string, string>();
  for (const p of [...projectRows, ...extraProjectRows]) {
    projectNameById.set(p.id, p.name);
  }
  const recipeNameById = new Map<string, string>();
  for (const r of recipeRows) recipeNameById.set(r.id, r.name);
  const slotById = new Map<string, { recipeName: string }>();
  for (const s of slotRows) {
    slotById.set(s.id, { recipeName: s.recipeName });
  }
  const wishlistById = new Map<
    string,
    { title: string; projectId: string | null }
  >();
  for (const w of wishlistRows) {
    wishlistById.set(w.id, { title: w.title, projectId: w.projectId });
  }

  return rows.map((r): ActivityStreamRow => {
    let displayName: string | null = null;
    let parentRecipeName: string | null = null;
    if (r.refId) {
      switch (r.kind) {
        case "stage_bump":
        case "project_created":
          displayName = projectNameById.get(r.refId) ?? null;
          break;
        case "recipe_created":
          displayName = recipeNameById.get(r.refId) ?? null;
          break;
        case "slot_added": {
          const slot = slotById.get(r.refId);
          if (slot) {
            parentRecipeName = slot.recipeName;
          }
          break;
        }
        case "paint_added": {
          const w = wishlistById.get(r.refId);
          if (w?.projectId) {
            displayName = projectNameById.get(w.projectId) ?? null;
          }
          break;
        }
      }
    }
    return {
      id: r.id,
      kind: r.kind,
      refId: r.refId,
      createdAt: r.createdAt,
      displayName,
      parentRecipeName,
    };
  });
}

/* ============================================================
   getActivityByDay — for the streak + heatmap widgets
   ============================================================ */

/**
 * One day's aggregated activity. Used by streak (counts the number
 * of consecutive days with a streak-qualifying entry) and heatmap
 * (colours each cell by `count`).
 *
 * `date` is `YYYY-MM-DD` in UTC. Server-side projection so the
 * boundary is deterministic regardless of the request's TZ.
 */
export interface ActivityDay {
  /** `YYYY-MM-DD`, UTC-projected. */
  date: string;
  count: number;
  /** Distinct kinds seen on this day. Streak uses this to filter to
   *  stage_bump + recipe_created. */
  kinds: ReadonlyArray<ActivityLogKind>;
}

/**
 * All activity rows since `sinceTs`, bucketed by day. The helper
 * does the grouping in application code rather than via SQL
 * `strftime('%Y-%m-%d', …)` so the same module works against
 * libsql in production AND the in-memory test fixture without a
 * dialect branch. Row volume is bounded by `sinceTs` (60–90 days
 * worth) so the cost stays small.
 */
export async function getActivityByDay(
  userId: string,
  sinceTs: Date,
): Promise<ReadonlyArray<ActivityDay>> {
  const rows = await db
    .select({
      kind: activityLog.kind,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.userId, userId),
        gte(activityLog.createdAt, sinceTs),
      ),
    )
    .orderBy(desc(activityLog.createdAt));

  const byDay = new Map<string, { count: number; kinds: Set<ActivityLogKind> }>();
  for (const r of rows) {
    const key = toDayKey(r.createdAt);
    const bucket = byDay.get(key) ?? { count: 0, kinds: new Set() };
    bucket.count += 1;
    bucket.kinds.add(r.kind);
    byDay.set(key, bucket);
  }

  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, b]) => ({
      date,
      count: b.count,
      kinds: [...b.kinds],
    }));
}

/**
 * UTC-projected `YYYY-MM-DD` for a Date. Exported for the streak +
 * heatmap widgets so they can derive "today" with the same
 * convention.
 */
export function toDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
