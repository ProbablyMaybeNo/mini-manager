"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
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
    await db
      .update(projects)
      .set(patch)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("project_stage_cascade")
        ? "Stage cascade violated. Refresh and try again."
        : "Failed to update counter.";
    return { ok: false, error: message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");

  return { ok: true, data: { ...snap, ...patch } };
}
