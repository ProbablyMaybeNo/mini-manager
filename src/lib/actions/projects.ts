"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { priorities, projects, projectTypes } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { DisplayStatus } from "@/lib/progress";

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

/* ============================================================
   R7-008 — inline-rename the project from its detail page.
   Replicates the recipe header's contentEditable <h1> pattern.
   ============================================================ */

const updateNameSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
});

export async function updateProjectName(
  raw: z.infer<typeof updateNameSchema>,
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = updateNameSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name",
    };
  }
  const { id, name } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select({ id: projects.id, parentId: projects.parentId })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  try {
    await db.update(projects).set({ name }).where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    if (project.parentId) {
      revalidatePath(`/projects/${project.parentId}`);
    }
    return { ok: true, data: { id, name } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rename project",
    };
  }
}

/* ============================================================
   R7-1 inline dashboard editing — type / priority / status bump
   ============================================================ */

const updateTypeSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(projectTypes),
});

/** R7-1 — inline Type cell on the projects dashboard. */
export async function updateProjectType(
  raw: z.infer<typeof updateTypeSchema>,
): Promise<ActionResult<{ id: string; type: (typeof projectTypes)[number] }>> {
  const parsed = updateTypeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid type",
    };
  }
  const { id, type } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  try {
    await db.update(projects).set({ type }).where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { ok: true, data: { id, type } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update type",
    };
  }
}

const updatePrioritySchema = z.object({
  id: z.string().min(1).max(64),
  priority: z.enum(priorities).nullable(),
});

/** R7-1 — inline Priority cell on the projects dashboard. `null` clears. */
export async function updateProjectPriority(
  raw: z.infer<typeof updatePrioritySchema>,
): Promise<
  ActionResult<{ id: string; priority: (typeof priorities)[number] | null }>
> {
  const parsed = updatePrioritySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid priority",
    };
  }
  const { id, priority } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  try {
    await db.update(projects).set({ priority }).where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { ok: true, data: { id, priority } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update priority",
    };
  }
}

const bumpStatusSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum([
    "WISHLIST",
    "PURCHASED",
    "BUILDING",
    "PRIMING",
    "PAINTING",
    "BASING",
    "COMPLETE",
    "SHELVED",
  ]),
});

/**
 * R7-1 — inline Status cell on the projects dashboard.
 *
 * Status is DERIVED from stage counts, so picking "Bump to PAINTING"
 * cascades counts so that the picked stage is the lead stage. Strategy
 * matches the cascade-CHECK constraint:
 *   count ≥ owned ≥ build ≥ prime ≥ paint ≥ base ≥ complete ≥ 0
 *
 * Ross approved option (a): no schema column for manual override. The
 * displayStatus() helper continues to derive the pill straight off the
 * stage counts.
 */
export async function bumpProjectStatus(
  raw: z.infer<typeof bumpStatusSchema>,
): Promise<ActionResult<{ id: string; status: DisplayStatus }>> {
  const parsed = bumpStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid status",
    };
  }
  const { id, status } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  // SHELVED is orthogonal — flips the boolean, leaves counters alone.
  if (status === "SHELVED") {
    try {
      await db
        .update(projects)
        .set({ isShelved: true })
        .where(eq(projects.id, id));
      revalidatePath("/projects");
      revalidatePath(`/projects/${id}`);
      return { ok: true, data: { id, status } };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to shelve",
      };
    }
  }

  // WISHLIST → zero everything (count === 0). Wishlist is the only state
  // where `count` is allowed to be zero.
  if (status === "WISHLIST") {
    try {
      await db
        .update(projects)
        .set({
          isShelved: false,
          count: 0,
          ownedCount: 0,
          buildCount: 0,
          primeCount: 0,
          paintCount: 0,
          baseCount: 0,
          completeCount: 0,
        })
        .where(eq(projects.id, id));
      revalidatePath("/projects");
      revalidatePath(`/projects/${id}`);
      return { ok: true, data: { id, status } };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to update status",
      };
    }
  }

  // Bump cascade. The picked status is the LEAD stage — i.e. the
  // most-advanced stage with any count > 0. To make displayStatus()
  // return exactly the picked value we:
  //
  //   * preserve count (forced to ≥ 1 since the project just left
  //     WISHLIST),
  //   * raise every stage at or below the lead to ≥ 1,
  //   * force every stage ABOVE the lead to 0,
  //   * keep the cascade-CHECK (count ≥ owned ≥ build ≥ prime ≥ paint
  //     ≥ base ≥ complete ≥ 0) intact.
  //
  // For COMPLETE the lead is the deepest stage, so every lane fills to
  // the full count.
  const baseCount = Math.max(1, project.count);

  type StageRule = {
    owned: number; // minimum
    build: number;
    prime: number;
    paint: number;
    base: number;
    complete: number;
  };

  const ZERO = 0;
  const ONE = 1;
  const FILL = baseCount;

  // Each key picks the minimum each stage gets. Stages above the picked
  // lead are then clamped to 0 below.
  const minByStatus: Record<
    Exclude<DisplayStatus, "SHELVED" | "WISHLIST">,
    StageRule
  > = {
    PURCHASED: { owned: ONE, build: ZERO, prime: ZERO, paint: ZERO, base: ZERO, complete: ZERO },
    BUILDING: { owned: ONE, build: ONE, prime: ZERO, paint: ZERO, base: ZERO, complete: ZERO },
    PRIMING: { owned: ONE, build: ONE, prime: ONE, paint: ZERO, base: ZERO, complete: ZERO },
    PAINTING: { owned: ONE, build: ONE, prime: ONE, paint: ONE, base: ZERO, complete: ZERO },
    BASING: { owned: ONE, build: ONE, prime: ONE, paint: ONE, base: ONE, complete: ZERO },
    COMPLETE: { owned: FILL, build: FILL, prime: FILL, paint: FILL, base: FILL, complete: FILL },
  };

  // For every stage strictly above the lead, the count must be 0
  // (else displayStatus would pick a more-advanced label). For every
  // stage at or below the lead, raise to max(current, 1) so the lead
  // logic in displayStatus() lands on the picked status.
  const above: Record<
    Exclude<DisplayStatus, "SHELVED" | "WISHLIST">,
    ReadonlySet<keyof StageRule>
  > = {
    PURCHASED: new Set(["build", "prime", "paint", "base", "complete"]),
    BUILDING: new Set(["prime", "paint", "base", "complete"]),
    PRIMING: new Set(["paint", "base", "complete"]),
    PAINTING: new Set(["base", "complete"]),
    BASING: new Set(["complete"]),
    COMPLETE: new Set([]),
  };

  const mins = minByStatus[status];
  const zeroed = above[status];

  const owned = zeroed.has("owned")
    ? 0
    : Math.min(baseCount, Math.max(project.ownedCount, mins.owned));
  const built = zeroed.has("build")
    ? 0
    : Math.min(owned, Math.max(project.buildCount, mins.build));
  const primed = zeroed.has("prime")
    ? 0
    : Math.min(built, Math.max(project.primeCount, mins.prime));
  const painted = zeroed.has("paint")
    ? 0
    : Math.min(primed, Math.max(project.paintCount, mins.paint));
  const based = zeroed.has("base")
    ? 0
    : Math.min(painted, Math.max(project.baseCount, mins.base));
  const complete = zeroed.has("complete")
    ? 0
    : Math.min(based, Math.max(project.completeCount, mins.complete));

  try {
    await db
      .update(projects)
      .set({
        isShelved: false,
        count: baseCount,
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
    return { ok: true, data: { id, status } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update status",
    };
  }
}
