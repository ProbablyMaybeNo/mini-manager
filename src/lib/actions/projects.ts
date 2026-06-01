"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects, projectTypes } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";

/**
 * Result for client components that want to render errors inline.
 * Server actions that redirect on success never resolve to this shape
 * — they throw the redirect — so the caller only sees this when the
 * action fails before the redirect.
 */
export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  type: z.enum(projectTypes),
  count: z.number().int().min(0, "Count cannot be negative").max(9999, "Count is too large"),
  parentId: z.string().min(1).max(32).nullish(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/**
 * Create a top-level or nested project. Validates the input, enforces
 * the 3-level nesting cap (Army → Unit → NamedModel), and redirects to
 * the new project's workspace. Throws via `redirect` on success.
 *
 * Returns `{ ok: false, error }` for any validation or constraint
 * failure so a client component can surface the message.
 */
export async function createProject(
  raw: CreateProjectInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid project" };
  }
  const { name, type, count, parentId } = parsed.data;

  const userId = await currentUserId();

  // Single Model is always 1 mini; don't let the form lie.
  const finalCount = type === "Single Model" ? 1 : count;

  // If a parent is supplied, validate ownership + nesting cap.
  let finalParentId: string | null = null;
  if (parentId) {
    const parentRows = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, parentId), eq(projects.ownerId, userId)))
      .limit(1);
    const parent = parentRows[0];
    if (!parent) {
      return { ok: false, error: "Parent project not found" };
    }
    if (parent.parentId !== null) {
      return {
        ok: false,
        error:
          "Maximum 3 levels of nesting: Army → Unit → Model. Pick a top-level Army or Warband.",
      };
    }
    if (parent.type !== "Army" && parent.type !== "Warband") {
      return {
        ok: false,
        error: "Only Army or Warband parents can contain sub-projects.",
      };
    }
    finalParentId = parent.id;
  }

  const inserted = await db
    .insert(projects)
    .values({
      ownerId: userId,
      parentId: finalParentId,
      type,
      name,
      count: finalCount,
    })
    .returning({ id: projects.id });

  const newRow = inserted[0];
  if (!newRow) {
    return { ok: false, error: "Failed to create project" };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${newRow.id}`);
  redirect(`/projects/${newRow.id}`);
}

/* ============================================================
   updateProjectCount — P12.10 inline ± on the Progress table.

   Validates the new count is non-negative + ≤ 9999, scopes by
   owner, and respects the stage-cascade CHECK constraint: lowering
   `count` below any existing stage counter would fail the SQL
   constraint, so we floor the cascade columns to `count` if the new
   value would shrink past them. Otherwise the database would reject
   the UPDATE entirely.
   ============================================================ */

const updateCountSchema = z.object({
  id: z.string().min(1).max(64),
  count: z.number().int().min(0).max(9999),
});

export async function updateProjectCount(
  raw: z.infer<typeof updateCountSchema>,
): Promise<ActionResult<{ id: string; count: number }>> {
  const parsed = updateCountSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid count",
    };
  }
  const { id, count } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  // Floor each cascade counter to the new `count` so we don't trip the
  // CHECK constraint when shrinking the total below an existing stage
  // count. Stages above the new count get clamped on the way down.
  const owned = Math.min(project.ownedCount, count);
  const built = Math.min(project.buildCount, owned);
  const primed = Math.min(project.primeCount, built);
  const painted = Math.min(project.paintCount, primed);
  const based = Math.min(project.baseCount, painted);
  const complete = Math.min(project.completeCount, based);

  try {
    await db
      .update(projects)
      .set({
        count,
        ownedCount: owned,
        buildCount: built,
        primeCount: primed,
        paintCount: painted,
        baseCount: based,
        completeCount: complete,
      })
      .where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    if (project.parentId) {
      revalidatePath(`/projects/${project.parentId}`);
    }
    return { ok: true, data: { id, count } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update count",
    };
  }
}
