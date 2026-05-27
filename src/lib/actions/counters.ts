"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { projects, type Project } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Stages that participate in the cascade, ordered from "highest"
 * (must always be ≥ the next) down to "lowest". This mirrors the
 * DB CHECK constraint `project_stage_cascade`:
 *
 *   count ≥ owned ≥ build ≥ prime ≥ paint ≥ base ≥ complete ≥ 0
 *
 * `count` is not bumpable from the workspace (it's set at create
 * time and via Edit project). Everything below is.
 */
export const counterStages = [
  "owned",
  "build",
  "prime",
  "paint",
  "base",
  "complete",
] as const;
export type CounterStage = (typeof counterStages)[number];

const bumpSchema = z.object({
  projectId: z.string().min(1).max(32),
  stage: z.enum(counterStages),
  delta: z.union([z.literal(1), z.literal(-1)]),
});

export type BumpCounterInput = z.infer<typeof bumpSchema>;

type StageColumn =
  | "ownedCount"
  | "buildCount"
  | "primeCount"
  | "paintCount"
  | "baseCount"
  | "completeCount";

const STAGE_COLUMN: Readonly<Record<CounterStage, StageColumn>> = {
  owned: "ownedCount",
  build: "buildCount",
  prime: "primeCount",
  paint: "paintCount",
  base: "baseCount",
  complete: "completeCount",
};

/**
 * Snapshot of just the cascade-relevant columns. Keeps the
 * pre-validation logic small and typed without dragging the
 * whole Project row through every helper.
 */
type CounterSnapshot = Pick<
  Project,
  | "count"
  | "ownedCount"
  | "buildCount"
  | "primeCount"
  | "paintCount"
  | "baseCount"
  | "completeCount"
>;

/**
 * Validate a proposed bump against the cascade BEFORE we hit the DB.
 * Returns the new value for the bumped column on success, or a
 * human-readable error string on failure. The DB CHECK constraint
 * is the second line of defense.
 */
export function validateBump(
  snap: CounterSnapshot,
  stage: CounterStage,
  delta: 1 | -1,
): { ok: true; nextValue: number } | { ok: false; error: string } {
  const col = STAGE_COLUMN[stage];
  const current = snap[col];
  const next = current + delta;

  if (next < 0) {
    return { ok: false, error: `${labelFor(stage)} can't go below 0.` };
  }

  // Upper bound: the stage immediately "above" this one in the cascade.
  // For owned, that's count. For everything else it's the prior stage.
  const upper = upperBoundFor(snap, stage);
  if (next > upper.value) {
    return {
      ok: false,
      error: `${labelFor(stage)} can't exceed ${upper.label} (${upper.value}).`,
    };
  }

  // Lower bound: the stage immediately "below" this one (if any).
  // Decreasing this stage below the one below would break the cascade.
  const lower = lowerBoundFor(snap, stage);
  if (lower && next < lower.value) {
    return {
      ok: false,
      error: `${labelFor(stage)} can't drop below ${lower.label} (${lower.value}).`,
    };
  }

  return { ok: true, nextValue: next };
}

function labelFor(stage: CounterStage): string {
  switch (stage) {
    case "owned":
      return "Owned";
    case "build":
      return "Build";
    case "prime":
      return "Prime";
    case "paint":
      return "Paint";
    case "base":
      return "Base";
    case "complete":
      return "Complete";
  }
}

/**
 * The stage immediately above (the "ceiling"). For owned, it's the
 * project count. For every other stage it's the previous one.
 */
function upperBoundFor(
  snap: CounterSnapshot,
  stage: CounterStage,
): { label: string; value: number } {
  switch (stage) {
    case "owned":
      return { label: "Count", value: snap.count };
    case "build":
      return { label: "Owned", value: snap.ownedCount };
    case "prime":
      return { label: "Build", value: snap.buildCount };
    case "paint":
      return { label: "Prime", value: snap.primeCount };
    case "base":
      return { label: "Paint", value: snap.paintCount };
    case "complete":
      return { label: "Base", value: snap.baseCount };
  }
}

/**
 * The stage immediately below (the "floor"). Returns null if
 * the stage is at the bottom of the cascade.
 */
function lowerBoundFor(
  snap: CounterSnapshot,
  stage: CounterStage,
): { label: string; value: number } | null {
  switch (stage) {
    case "owned":
      return { label: "Build", value: snap.buildCount };
    case "build":
      return { label: "Prime", value: snap.primeCount };
    case "prime":
      return { label: "Paint", value: snap.paintCount };
    case "paint":
      return { label: "Base", value: snap.baseCount };
    case "base":
      return { label: "Complete", value: snap.completeCount };
    case "complete":
      return null;
  }
}

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

  const userId = currentUserId();

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
    // DB CHECK constraint hit despite pre-validation — surface a clean
    // error rather than the raw SQLite message.
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
