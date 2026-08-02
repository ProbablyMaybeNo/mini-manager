import type { Project } from "@/db/schema";

/**
 * The painting stages, in workflow order. Each is an INDEPENDENT tally of
 * "how many of the N models are through this step" — bounded by 0 and the
 * model count, and by nothing else.
 *
 * They used to be a strict cascade (count ≥ owned ≥ build ≥ prime ≥ paint ≥
 * base ≥ complete), which sounded right — you can't prime what you haven't
 * built — and in practice just built walls. A unit created at PRIMED got
 * owned = 1, which pinned build at 1, which pinned prime at 1, and there is no
 * Owned control anywhere to unpin it; every + returned "can't exceed Owned".
 * Ross, 2026-08-01: "just remove all the requirements so players can just -/+
 * as they please." The DB CHECK (`project_stage_bounds`) matches.
 *
 * `count` is not bumpable from the workspace (it's set at create time and via
 * Edit project). Everything below is.
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

export type StageColumn =
  | "ownedCount"
  | "buildCount"
  | "primeCount"
  | "paintCount"
  | "baseCount"
  | "completeCount";

export const STAGE_COLUMN: Readonly<Record<CounterStage, StageColumn>> = {
  owned: "ownedCount",
  build: "buildCount",
  prime: "primeCount",
  paint: "paintCount",
  base: "baseCount",
  complete: "completeCount",
};

/**
 * Snapshot of just the counter columns. Keeps the pre-validation logic small
 * and typed without dragging the whole Project row through every helper.
 */
export type CounterSnapshot = Pick<
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
 * Validate a proposed bump. The only rules left are the two that describe
 * physical reality: you can't have fewer than none of a stage done, and you
 * can't have more done than there are models. Stage order is not enforced —
 * painters skip and backtrack, and the app has no business arguing.
 */
export function validateBump(
  snap: CounterSnapshot,
  stage: CounterStage,
  delta: 1 | -1,
): { ok: true; nextValue: number } | { ok: false; error: string } {
  const next = snap[STAGE_COLUMN[stage]] + delta;

  if (next < 0) {
    return { ok: false, error: `${labelFor(stage)} can't go below 0.` };
  }
  if (next > snap.count) {
    return {
      ok: false,
      error: `${labelFor(stage)} can't exceed the model count (${snap.count}).`,
    };
  }
  return { ok: true, nextValue: next };
}

export function labelFor(stage: CounterStage): string {
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
