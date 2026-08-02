"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { logActivity } from "@/lib/activityLog";
import type { ActionResult } from "@/lib/actions/projects";
import {
  STAGE_COLUMN,
  counterStages,
  labelFor,
  validateBump,
  type CounterSnapshot,
} from "@/lib/counters/cascade";

const bumpSchema = z.object({
  projectId: z.string().min(1).max(32),
  stage: z.enum(counterStages),
  delta: z.union([z.literal(1), z.literal(-1)]),
});

export type BumpCounterInput = z.infer<typeof bumpSchema>;

const setSchema = z.object({
  projectId: z.string().min(1).max(32),
  stage: z.enum(counterStages),
  value: z.number().int().min(0).max(100000),
});

export type SetCounterInput = z.infer<typeof setSchema>;

/**
 * Bump a single stage counter on a project by +1 or -1. Bounds-checked
 * pre-write so we can return a friendly error; the DB CHECK constraint
 * guarantees integrity if a race ever slips through.
 *
 * Returns the updated snapshot on success so the client can sync
 * (the `useTransition` caller still gets a fresh server render via
 * `revalidatePath`, but the snapshot lets it confirm).
 */
export async function bumpCounter(
  raw: BumpCounterInput,
): Promise<ActionResult<CounterSnapshot>> {
  const parsed = bumpSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid bump" };
  }
  const { projectId, stage, delta } = parsed.data;

  const userId = await currentUserId();

  const rows = await db
    .select({
      count: projects.count,
      ownedCount: projects.ownedCount,
      buildCount: projects.buildCount,
      primeCount: projects.primeCount,
      paintCount: projects.paintCount,
      baseCount: projects.baseCount,
      completeCount: projects.completeCount,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);

  const snap = rows[0];
  if (!snap) {
    return { ok: false, error: "Project not found" };
  }

  const check = validateBump(snap, stage, delta);
  if (!check.ok) return check;

  const col = STAGE_COLUMN[stage];
  const patch: Partial<CounterSnapshot> = { [col]: check.nextValue };

  try {
    // Atomic increment — `SET col = col + delta` instead of `SET col = N`.
    // Under concurrent + clicks (the UI no longer disables the button on
    // isPending so users can hold-tap +), two writes both reading the
    // same old snapshot would lose-update if we wrote literal values.
    // The DB CHECK bounds catch any over-increment that slips past the
    // pre-validation read.
    await db
      .update(projects)
      .set({ [col]: sql`${projects[col]} + ${delta}` } as Partial<CounterSnapshot>)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("project_stage_bounds")
        ? "That would put the count outside 0–the model count. Refresh and try again."
        : "Failed to update counter.";
    return { ok: false, error: message };
  }

  // P14.1 — feed the PLANNER activity stream + heatmap + streak.
  await logActivity(userId, "stage_bump", projectId);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { ok: true, data: { ...snap, ...patch } };
}

/**
 * M6 — set a stage counter to an absolute value (the StageCounter's
 * tap-number-to-type for large counts [MOBILE §M6 step 4]). Bounded by 0 and
 * the model count and nothing else; the DB CHECK is the second line of
 * defence. See `counterStages` for why stage order isn't enforced.
 */
export async function setCounter(
  raw: SetCounterInput,
): Promise<ActionResult<CounterSnapshot>> {
  const parsed = setSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid value" };
  }
  const { projectId, stage, value } = parsed.data;

  const userId = await currentUserId();

  const rows = await db
    .select({
      count: projects.count,
      ownedCount: projects.ownedCount,
      buildCount: projects.buildCount,
      primeCount: projects.primeCount,
      paintCount: projects.paintCount,
      baseCount: projects.baseCount,
      completeCount: projects.completeCount,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);

  const snap = rows[0];
  if (!snap) {
    return { ok: false, error: "Project not found" };
  }

  const check = validateSetValue(snap, stage, value);
  if (!check.ok) return check;

  const col = STAGE_COLUMN[stage];
  const patch: Partial<CounterSnapshot> = { [col]: value };

  try {
    await db
      .update(projects)
      .set({ [col]: value } as Partial<CounterSnapshot>)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("project_stage_bounds")
        ? "That would put the count outside 0–the model count. Refresh and try again."
        : "Failed to update counter.";
    return { ok: false, error: message };
  }

  await logActivity(userId, "stage_bump", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { ok: true, data: { ...snap, ...patch } };
}

/**
 * Load a project's cascade counter snapshot (count + the six stage columns).
 * Powers the Unit panel's Built/Primed/Painted/Completed steppers, which seed
 * from the real DB counts and stay in sync via setCounter's returned snapshot.
 * Owner-scoped; null if the project doesn't exist for this user.
 */
export async function loadProjectCounters(
  id: string,
): Promise<CounterSnapshot | null> {
  const userId = await currentUserId();
  const rows = await db
    .select({
      count: projects.count,
      ownedCount: projects.ownedCount,
      buildCount: projects.buildCount,
      primeCount: projects.primeCount,
      paintCount: projects.paintCount,
      baseCount: projects.baseCount,
      completeCount: projects.completeCount,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Bounds-check an absolute target: 0 ≤ value ≤ model count. Stage order is
 *  deliberately not enforced — see `counterStages`. */
function validateSetValue(
  snap: CounterSnapshot,
  stage: z.infer<typeof setSchema>["stage"],
  value: number,
): { ok: true } | { ok: false; error: string } {
  if (value > snap.count) {
    return {
      ok: false,
      error: `${labelFor(stage)} can't exceed the model count (${snap.count}).`,
    };
  }
  return { ok: true };
}
