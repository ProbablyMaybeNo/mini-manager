import type { Project } from "@/db/schema";

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
 * Snapshot of just the cascade-relevant columns. Keeps the
 * pre-validation logic small and typed without dragging the
 * whole Project row through every helper.
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

  const upper = upperBoundFor(snap, stage);
  if (next > upper.value) {
    return {
      ok: false,
      error: `${labelFor(stage)} can't exceed ${upper.label} (${upper.value}).`,
    };
  }

  const lower = lowerBoundFor(snap, stage);
  if (lower && next < lower.value) {
    return {
      ok: false,
      error: `${labelFor(stage)} can't drop below ${lower.label} (${lower.value}).`,
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
