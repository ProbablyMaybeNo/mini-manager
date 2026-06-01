import "server-only";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projects, recipes } from "@/db/schema";
import type { Project, Recipe } from "@/db/schema";

/**
 * Top-level projects (parent_id IS NULL) for a user.
 *
 * P13.4 — the named-model count column was removed when the
 * named_model table was dropped. The previous aggregator that
 * returned `namedModelCount` is no longer needed because every
 * former named model is now a first-class child Unit project.
 */
export async function listTopLevelProjects(
  userId: string,
): Promise<ReadonlyArray<Project>> {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        isNull(projects.parentId),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(desc(projects.updatedAt));
}

/**
 * Every non-archived project for a user, including children.
 * Used for the aggregation roll-up on Army parents.
 */
export async function listAllProjects(userId: string): Promise<ReadonlyArray<Project>> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, userId), isNull(projects.archivedAt)))
    .orderBy(asc(projects.parentId), asc(projects.createdAt));
}

/**
 * Backlog ("pile of shame"): units where the painter owns models
 * they haven't started building yet. Returns the units (NOT armies)
 * sorted oldest-first so the guilt-trip lands.
 */
export async function listBacklogUnits(
  userId: string,
): Promise<ReadonlyArray<Project>> {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        isNull(projects.archivedAt),
        eq(projects.isShelved, false),
        sql`${projects.ownedCount} > ${projects.buildCount}`,
      ),
    )
    .orderBy(asc(projects.createdAt));
}

/**
 * Active projects: anything with paint applied but not yet complete.
 */
export async function listActiveProjects(
  userId: string,
): Promise<ReadonlyArray<Project>> {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        isNull(projects.archivedAt),
        eq(projects.isShelved, false),
        sql`${projects.paintCount} > 0`,
        sql`${projects.completeCount} < ${projects.count}`,
      ),
    )
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectById(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Project + the recipes attached directly to it. Returns `null` if
 * the project doesn't exist or the caller doesn't own it.
 */
export async function getProjectWithRecipe(
  userId: string,
  projectId: string,
): Promise<{ project: Project; recipes: ReadonlyArray<Recipe> } | null> {
  const project = await getProjectById(userId, projectId);
  if (!project) return null;
  const attached = await db
    .select()
    .from(recipes)
    .where(
      and(
        eq(recipes.ownerId, userId),
        eq(recipes.attachedProjectId, project.id),
      ),
    )
    .orderBy(desc(recipes.updatedAt));
  return { project, recipes: attached };
}

/**
 * Direct children of a project (one level deep, no grand-children).
 * Used by the workspace tree on Army / Warband / Unit parents.
 * Verifies ownership via `ownerId` so a malicious parent id from
 * another owner returns an empty list rather than leaking rows.
 */
export async function listChildProjects(
  userId: string,
  parentId: string,
): Promise<ReadonlyArray<Project>> {
  return db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        eq(projects.parentId, parentId),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(asc(projects.createdAt));
}

/**
 * Parents that can host sub-projects. P13.4 widens the set to include
 * Unit (every sub-project must be a Unit per the new type rule;
 * Army/Warband/Unit can all be parents).
 */
export async function listParentCandidates(
  userId: string,
): Promise<ReadonlyArray<Pick<Project, "id" | "name" | "type" | "faction">>> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      faction: projects.faction,
    })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        isNull(projects.parentId),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(asc(projects.name));
  return rows.filter(
    (r) => r.type === "Army" || r.type === "Warband" || r.type === "Unit",
  );
}
