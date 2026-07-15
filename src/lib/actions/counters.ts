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
 * Bump a single stage counter on a project by +1 or -1. Validates
 * the cascade pre-write so we can return a friendly error; the DB
 * CHECK constraint guarantees integrity if a race ever slips through.
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
    // The DB CHECK cascade catches any over-increment that slips past
    // the pre-validation read.
    await db
      .update(projects)
      .set({ [col]: sql`${projects[col]} + ${delta}` } as Partial<CounterSnapshot>)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("project_stage_cascade")
        ? "Stage cascade violated. Refresh and try again."
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
 * tap-number-to-type for large counts [MOBILE §M6 step 4]). Validates the
 * target against the cascade's immediate upper/lower neighbours so a typed
 * value can't break `count ≥ owned ≥ build ≥ prime ≥ paint ≥ base ≥ done`;
 * the DB CHECK constraint is the second line of defence.
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
      err instanceof Error && err.message.includes("project_stage_cascade")
        ? "Stage cascade violated. Refresh and try again."
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

/** Cascade-validate an absolute target for a stage against its immediate
 *  neighbours. Mirrors the bump cascade: each stage is bounded above by
 *  the next-shallower stage's count and below by the next-deeper one. */
function validateSetValue(
  snap: CounterSnapshot,
  stage: z.infer<typeof setSchema>["stage"],
  value: number,
): { ok: true } | { ok: false; error: string } {
  const upper: Record<typeof stage, { label: string; value: number }> = {
    owned: { label: "Count", value: snap.count },
    build: { label: "Owned", value: snap.ownedCount },
    prime: { label: "Build", value: snap.buildCount },
    paint: { label: "Prime", value: snap.primeCount },
    base: { label: "Paint", value: snap.paintCount },
    complete: { label: "Base", value: snap.baseCount },
  };
  const lower: Record<typeof stage, { label: string; value: number } | null> = {
    owned: { label: "Build", value: snap.buildCount },
    build: { label: "Prime", value: snap.primeCount },
    prime: { label: "Paint", value: snap.paintCount },
    paint: { label: "Base", value: snap.baseCount },
    base: { label: "Complete", value: snap.completeCount },
    complete: null,
  };
  if (value > upper[stage].value) {
    return {
      ok: false,
      error: `${stage} can't exceed ${upper[stage].label} (${upper[stage].value}).`,
    };
  }
  const lo = lower[stage];
  if (lo && value < lo.value) {
    return {
      ok: false,
      error: `${stage} can't drop below ${lo.label} (${lo.value}).`,
    };
  }
  return { ok: true };
}
