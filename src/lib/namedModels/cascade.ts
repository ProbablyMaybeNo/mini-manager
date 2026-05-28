import type { NamedModel } from "@/db/schema";

/**
 * Boolean stages on a named model, ordered from "lowest" (must be
 * true first) to "highest" (only true if the prior is also true).
 * This mirrors the DB CHECK constraint `named_model_stage_cascade`:
 *
 *   isBuilt ≥ isPrimed ≥ isPainted ≥ isBased ≥ isComplete
 *
 * (where "≥" on booleans means "if upper is true, lower must be true").
 */
export const namedModelStages = [
  "isBuilt",
  "isPrimed",
  "isPainted",
  "isBased",
  "isComplete",
] as const;
export type NamedModelStage = (typeof namedModelStages)[number];

export type NamedModelStageSnapshot = Pick<
  NamedModel,
  "isBuilt" | "isPrimed" | "isPainted" | "isBased" | "isComplete"
>;

export function labelFor(stage: NamedModelStage): string {
  switch (stage) {
    case "isBuilt":
      return "Built";
    case "isPrimed":
      return "Primed";
    case "isPainted":
      return "Painted";
    case "isBased":
      return "Based";
    case "isComplete":
      return "Complete";
  }
}

/**
 * Given a stage and its desired next value, walk the cascade and
 * return either the patch we should write OR a friendly error.
 *
 * Toggling ON a stage requires every prior stage to already be on
 * (the painter must explicitly tick Built/Primed before Painted).
 * Toggling OFF a stage cascades the untick down so one click does
 * the right thing (e.g. unticking Primed clears Painted/Based/Complete).
 */
export function applyToggle(
  snap: NamedModelStageSnapshot,
  stage: NamedModelStage,
  nextValue: boolean,
):
  | { ok: true; patch: NamedModelStageSnapshot }
  | { ok: false; error: string } {
  const idx = namedModelStages.indexOf(stage);
  if (idx === -1) {
    return { ok: false, error: "Unknown stage" };
  }

  const patch: NamedModelStageSnapshot = { ...snap, [stage]: nextValue };

  if (nextValue) {
    for (let i = 0; i < idx; i += 1) {
      const earlier = namedModelStages[i];
      if (earlier === undefined) continue;
      if (!snap[earlier]) {
        return { ok: false, error: `Tick ${labelFor(earlier)} first.` };
      }
    }
  } else {
    for (let i = idx + 1; i < namedModelStages.length; i += 1) {
      const later = namedModelStages[i];
      if (later === undefined) continue;
      patch[later] = false;
    }
  }

  return { ok: true, patch };
}
