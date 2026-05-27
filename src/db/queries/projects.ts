import "server-only";

import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { namedModels, projects } from "@/db/schema";
import type { NamedModel, Project } from "@/db/schema";

/**
 * Top-level projects (parent_id IS NULL) for a user.
 * Returns the rows + a per-row named-model count so the UI can
 * cheaply render aggregate counters without N+1 queries.
 */
export async function listTopLevelProjects(
  userId: string,
): Promise<ReadonlyArray<Project & { namedModelCount: number }>> {
  const rows = await db
    .select({
      project: projects,
      namedModelCount: sql<number>`(
        SELECT COUNT(*) FROM ${namedModels}
        WHERE ${namedModels.projectId} = ${projects.id}
      )`,
    })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, userId),
        isNull(projects.parentId),
        isNull(projects.archivedAt),
      ),
    )
    .orderBy(desc(projects.updatedAt));

  return rows.map((r) => ({ ...r.project, namedModelCount: r.namedModelCount }));
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
 * Named-model count per project, returned as a record keyed by project id.
 */
export async function countNamedModelsByProject(
  userId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      projectId: namedModels.projectId,
      n: count(),
    })
    .from(namedModels)
    .innerJoin(projects, eq(projects.id, namedModels.projectId))
    .where(eq(projects.ownerId, userId))
    .groupBy(namedModels.projectId);
  const out: Record<string, number> = {};
  for (const row of rows) out[row.projectId] = row.n;
  return out;
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
 * Named models belonging to a project, ordered by position then
 * creation time. Verifies project ownership via an inner join so
 * a malicious projectId from another owner returns an empty list
 * rather than leaking rows.
 */
export async function listNamedModelsByProject(
  userId: string,
  projectId: string,
): Promise<ReadonlyArray<NamedModel>> {
  const rows = await db
    .select({ namedModel: namedModels })
    .from(namedModels)
    .innerJoin(projects, eq(projects.id, namedModels.projectId))
    .where(
      and(
        eq(namedModels.projectId, projectId),
        eq(projects.ownerId, userId),
      ),
    )
    .orderBy(asc(namedModels.position), asc(namedModels.createdAt));
  return rows.map((r) => r.namedModel);
}

/**
 * Direct children of a project (one level deep, no grand-children).
 * Used by the workspace tree on Army / Warband parents. Verifies
 * ownership via `ownerId` so a malicious parent id from another
 * owner returns an empty list rather than leaking rows.
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
 * Parents that can host sub-projects: top-level Army or Warband rows.
 * Returns a slim shape — only fields the parent picker needs.
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
  return rows.filter((r) => r.type === "Army" || r.type === "Warband");
}
