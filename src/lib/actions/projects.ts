"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count as countFn, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { priorities, projects, projectTypes } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { logActivity } from "@/lib/activityLog";
import { enforceCreateLimit } from "@/lib/billing/enforce";
import type { DisplayStatus } from "@/lib/progress";

/**
 * Result for client components that want to render errors inline.
 * Server actions that redirect on success never resolve to this shape
 * — they throw the redirect — so the caller only sees this when the
 * action fails before the redirect.
 */
export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /**
       * P10.2 — optional CTA for free-tier limit rejections. When set,
       * UI surfaces render a soft "Upgrade →" link inline with the
       * error so the painter can move from "this is blocked" to
       * "okay, where do I pay" in one click. Any other rejection
       * (validation, ownership, db error) leaves this unset and
       * the link doesn't render.
       */
      upgradeUrl?: string;
    };

/**
 * Containment rules (Ross, 2026-06-23): which child types each parent type
 * may host. A parent type absent from this map is a leaf (Model, Terrain
 * Piece, Diorama) and can contain nothing. Values are DB `projectTypes`
 * literals so they validate directly against the create schema.
 */
const CHILD_TYPES: Partial<
  Record<(typeof projectTypes)[number], ReadonlyArray<(typeof projectTypes)[number]>>
> = {
  Army: ["Unit", "Warband", "Model", "Terrain Piece"],
  Warband: ["Model"],
  Unit: ["Model"],
};

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  type: z.enum(projectTypes),
  count: z.number().int().min(0, "Count cannot be negative").max(9999, "Count is too large"),
  parentId: z.string().min(1).max(32).nullish(),
  // Item 2 — optional faction + game/system the army is built for. Both
  // free text, trimmed; empty strings collapse to null so we don't store
  // blank rows. Length-capped to keep the columns sane.
  faction: z
    .string()
    .trim()
    .max(80, "Faction is too long")
    .nullish()
    .transform((v) => (v ? v : null)),
  game: z
    .string()
    .trim()
    .max(80, "Game is too long")
    .nullish()
    .transform((v) => (v ? v : null)),
});

// Use the schema's INPUT type for the public action signature: faction
// + game are optional on the wire (the .transform() normalises blank →
// null on the OUTPUT side, but callers shouldn't be forced to pass them).
export type CreateProjectInput = z.input<typeof createProjectSchema>;

/**
 * Create a top-level or nested project. Validates the input, enforces
 * the 3-level nesting cap (Army → Unit → Unit), and redirects to the
 * new project's workspace. Throws via `redirect` on success.
 *
 * Returns `{ ok: false, error }` for any validation or constraint
 * failure so a client component can surface the message.
 *
 * P13.4 sub-project type rule: Army/Warband/Unit parents host ONLY
 * Unit children. Terrain Piece + Diorama are top-level only.
 */
export async function createProject(
  raw: CreateProjectInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid project" };
  }
  const { name, type, count, parentId, faction, game } = parsed.data;

  const userId = await currentUserId();

  // P10.2 — Free-tier project cap (1 project). Count the user's current
  // owned projects then ask the billing enforcer if one more fits. Paid
  // tiers are unlimited so the COUNT is wasted but cheap. Cap is on the
  // OWNER's rows, including nested sub-projects — a free user can park
  // one Army with no sub-units OR one standalone Unit.
  const ownedRows = await db
    .select({ n: countFn() })
    .from(projects)
    .where(eq(projects.ownerId, userId));
  const projectGate = await enforceCreateLimit(
    userId,
    "projects",
    ownedRows[0]?.n ?? 0,
  );
  if (projectGate) return projectGate;

  // If a parent is supplied, validate ownership + the containment rules.
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
    // 2026-06-23 containment rules (Ross): an Army hosts Units, Warbands,
    // Models and Terrain; a Unit or a Warband hosts Models only; Models +
    // Terrain are leaves. CHILD_TYPES is the single source of truth — a
    // parent type absent from the map is a leaf and can't contain anything.
    const allowed = CHILD_TYPES[parent.type];
    if (!allowed) {
      return {
        ok: false,
        error: `A ${parent.type} can't contain sub-projects.`,
      };
    }
    if (!allowed.includes(type)) {
      return {
        ok: false,
        error: `A ${parent.type} can contain: ${allowed.join(", ")}.`,
      };
    }
    // 3-level depth cap (Army → Unit/Warband → Model). A parent that is
    // itself nested may only host leaf Models, so the tree never goes deeper
    // than three tiers. The CHILD_TYPES map already bounds this (Unit/Warband
    // only yield Models), but the explicit guard keeps the error legible.
    if (parent.parentId !== null && type !== "Model") {
      return {
        ok: false,
        error:
          "Maximum 3 levels of nesting — only a Model can be added this deep.",
      };
    }
    finalParentId = parent.id;
  } else {
    // Top-level types only — Terrain Piece + Diorama stay leaf-only
    // (they're allowed top-level), but Unit at the top-level is also
    // fine (standalone squad with no parent army).
  }

  const inserted = await db
    .insert(projects)
    .values({
      ownerId: userId,
      parentId: finalParentId,
      type,
      name,
      count,
      faction,
      game,
    })
    .returning({ id: projects.id });

  const newRow = inserted[0];
  if (!newRow) {
    return { ok: false, error: "Failed to create project" };
  }

  // P14.1 — feed the PLANNER activity stream.
  await logActivity(userId, "project_created", newRow.id);

  // REBUILD — return the new id (the redesign drives navigation client-side);
  // the old server redirect targeted the retired /projects route.
  revalidatePath("/dashboard");
  return { ok: true, data: { id: newRow.id } };
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
   setProjectComplete — the focus bench's "models painted" stepper.
   Sets how many models are fully complete, raising (never lowering)
   the earlier stage counters so the strict cascade CHECK holds. Marking
   N complete implies at least N models reached every prior stage; an
   existing higher stage count is preserved.
   ============================================================ */

const setCompleteSchema = z.object({
  id: z.string().min(1).max(64),
  complete: z.number().int().min(0).max(9999),
});

export async function setProjectComplete(
  raw: z.infer<typeof setCompleteSchema>,
): Promise<ActionResult<{ id: string; complete: number }>> {
  const parsed = setCompleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid count",
    };
  }
  const { id, complete } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  // Raise each prior stage to at least the next so monotonicity holds,
  // without regressing any stage the painter already advanced further.
  const based = Math.max(project.baseCount, complete);
  const painted = Math.max(project.paintCount, based);
  const primed = Math.max(project.primeCount, painted);
  const built = Math.max(project.buildCount, primed);
  const owned = Math.max(project.ownedCount, built);
  const total = Math.max(project.count, owned);

  try {
    await db
      .update(projects)
      .set({
        count: total,
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
    revalidatePath("/focus");
    if (project.parentId) revalidatePath(`/projects/${project.parentId}`);
    return { ok: true, data: { id, complete } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update progress",
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
   batch/model-warband — inline per-model "Class" cell.

   Sets the free-text `model_class` label on a model (Unit sub-project)
   row inside a Warband's models table. Owner-scoped, trimmed, length-
   capped at 40, blank → null (so an emptied cell clears the column
   rather than storing "" — mirrors the faction/game blank handling in
   createProject). The displayed cell surfaces only on Warband model
   rows; the action itself stays type-agnostic so it composes with the
   existing dashboard-editing actions below.
   ============================================================ */

const setModelClassSchema = z.object({
  id: z.string().min(1).max(64),
  modelClass: z
    .string()
    .trim()
    .max(40, "Class is too long")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type SetModelClassInput = z.input<typeof setModelClassSchema>;

export async function setModelClass(
  raw: SetModelClassInput,
): Promise<ActionResult<{ id: string; modelClass: string | null }>> {
  const parsed = setModelClassSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid class",
    };
  }
  const { id, modelClass } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select({ id: projects.id, parentId: projects.parentId })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  try {
    await db.update(projects).set({ modelClass }).where(eq(projects.id, id));
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    if (project.parentId) {
      revalidatePath(`/projects/${project.parentId}`);
    }
    return { ok: true, data: { id, modelClass } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update class",
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
    "OWNED",
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
      // P14.1 — every status bump counts as a stage_bump for the
      // PLANNER stream, regardless of which branch we took.
      await logActivity(userId, "stage_bump", id);
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
      await logActivity(userId, "stage_bump", id);
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
    OWNED: { owned: ONE, build: ZERO, prime: ZERO, paint: ZERO, base: ZERO, complete: ZERO },
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
    OWNED: new Set(["build", "prime", "paint", "base", "complete"]),
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
    await logActivity(userId, "stage_bump", id);
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

/* ============================================================
   P13.3 — deleteProject + cascade

   Removes a project and every descendant in one shot. The schema
   already has `onDelete: cascade` on `project.parentId`, so a single
   DELETE on the root row triggers the rest. We still compute the
   descendant set up-front so we can return the cascade count to the
   caller (used by the confirm modal microcopy).

   Ownership scoped: only the owner can delete. Attached recipes lose
   their `attached_project_id` (FK `ON DELETE set null`), not their
   data — so the painter doesn't lose a recipe because they deleted
   the project they had it attached to.
============================================================ */

const deleteProjectSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function deleteProject(
  raw: z.infer<typeof deleteProjectSchema>,
): Promise<ActionResult<{ id: string; descendantCount: number }>> {
  const parsed = deleteProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const { id } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  const project = rows[0];
  if (!project) return { ok: false, error: "Project not found" };

  // Walk descendants from the in-memory project list — SQLite has no
  // native recursive CTE wired through our drizzle helpers, but the
  // numbers here are tiny (a painter's full tree) so the JS walk is
  // cheap and stays consistent with the workspace page's helper.
  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId));
  const childrenByParent = new Map<string, string[]>();
  for (const p of allProjects) {
    if (!p.parentId) continue;
    const arr = childrenByParent.get(p.parentId) ?? [];
    arr.push(p.id);
    childrenByParent.set(p.parentId, arr);
  }
  const descendants: string[] = [];
  const stack: string[] = [id];
  while (stack.length > 0) {
    const head = stack.pop();
    if (head === undefined) break;
    for (const childId of childrenByParent.get(head) ?? []) {
      descendants.push(childId);
      stack.push(childId);
    }
  }

  const parentId = project.parentId;

  try {
    // Cascade is handled by `onDelete: cascade` on project.parentId —
    // a single DELETE removes the whole sub-tree.
    await db.delete(projects).where(eq(projects.id, id));
    revalidatePath("/projects");
    if (parentId) revalidatePath(`/projects/${parentId}`);
    return {
      ok: true,
      data: { id, descendantCount: descendants.length },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete project",
    };
  }
}

/**
 * P13.3 — Lightweight descendant counter used by the confirm modal so
 * the prompt can read "Delete X and N sub-projects?". Returns the
 * descendant count (NOT including the project itself). Owner-scoped.
 */
export async function countProjectDescendants(
  raw: z.infer<typeof deleteProjectSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = deleteProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const { id } = parsed.data;
  const userId = await currentUserId();

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  if (rows.length === 0) {
    return { ok: false, error: "Project not found" };
  }

  const allProjects = await db
    .select({ id: projects.id, parentId: projects.parentId })
    .from(projects)
    .where(eq(projects.ownerId, userId));
  const childrenByParent = new Map<string, string[]>();
  for (const p of allProjects) {
    if (!p.parentId) continue;
    const arr = childrenByParent.get(p.parentId) ?? [];
    arr.push(p.id);
    childrenByParent.set(p.parentId, arr);
  }
  let count = 0;
  const stack: string[] = [id];
  while (stack.length > 0) {
    const head = stack.pop();
    if (head === undefined) break;
    for (const childId of childrenByParent.get(head) ?? []) {
      count++;
      stack.push(childId);
    }
  }
  return { ok: true, data: { count } };
}

/* ============================================================
   duplicateProject — deep-copy a project + its whole sub-tree.

   Clones the row's type, counters, priority, deadline, notes and
   reference image, re-parenting each descendant under its freshly
   minted parent so the tree shape is preserved. The root copy gets a
   " (copy)" suffix; descendants keep their names. Attached recipes are
   NOT cloned (a recipe stays with its original project). Owner-scoped.
============================================================ */

const duplicateSchema = z.object({ id: z.string().min(1).max(64) });

export async function duplicateProject(
  raw: z.infer<typeof duplicateSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = duplicateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid id" };
  }
  const { id } = parsed.data;
  const userId = await currentUserId();

  // Pull the owner's whole tree once so we can both verify ownership and
  // walk the sub-tree without N round-trips.
  const all = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId));
  const root = all.find((p) => p.id === id);
  if (!root) return { ok: false, error: "Project not found" };

  // Free-tier gate mirrors createProject (no-op while BILLING_ENFORCED is off).
  const gate = await enforceCreateLimit(userId, "projects", all.length);
  if (gate) return gate;

  const childrenByParent = new Map<string, typeof all>();
  for (const p of all) {
    if (!p.parentId) continue;
    const arr = childrenByParent.get(p.parentId) ?? [];
    arr.push(p);
    childrenByParent.set(p.parentId, arr);
  }

  /** Copy one row under `newParentId`, returning the inserted id. */
  async function copyRow(
    src: (typeof all)[number],
    newParentId: string | null,
    nameOverride?: string,
  ): Promise<string | null> {
    const inserted = await db
      .insert(projects)
      .values({
        ownerId: userId,
        parentId: newParentId,
        type: src.type,
        name: nameOverride ?? src.name,
        count: src.count,
        ownedCount: src.ownedCount,
        buildCount: src.buildCount,
        primeCount: src.primeCount,
        paintCount: src.paintCount,
        baseCount: src.baseCount,
        completeCount: src.completeCount,
        isShelved: src.isShelved,
        faction: src.faction,
        game: src.game,
        modelClass: src.modelClass,
        priority: src.priority,
        targetDate: src.targetDate,
        pointsValue: src.pointsValue,
        notesMd: src.notesMd,
        referenceImageUrl: src.referenceImageUrl,
      })
      .returning({ id: projects.id });
    return inserted[0]?.id ?? null;
  }

  try {
    const newRootId = await copyRow(root, root.parentId, `${root.name} (copy)`);
    if (!newRootId) return { ok: false, error: "Failed to duplicate project" };

    // BFS the sub-tree, mapping each old id → its new id so children attach
    // to the freshly minted parent.
    const idMap = new Map<string, string>([[root.id, newRootId]]);
    const queue: string[] = [root.id];
    while (queue.length > 0) {
      const oldParent = queue.shift();
      if (oldParent === undefined) break;
      const newParent = idMap.get(oldParent);
      if (!newParent) continue;
      for (const child of childrenByParent.get(oldParent) ?? []) {
        const newChildId = await copyRow(child, newParent);
        if (newChildId) {
          idMap.set(child.id, newChildId);
          queue.push(child.id);
        }
      }
    }

    await logActivity(userId, "project_created", newRootId);
    revalidatePath("/dashboard");
    if (root.parentId) revalidatePath(`/projects/${root.parentId}`);
    return { ok: true, data: { id: newRootId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to duplicate project",
    };
  }
}
