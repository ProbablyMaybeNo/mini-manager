/**
 * P15.x — `buildFocusZones` view-model builder.
 *
 * The dashboard threads three side-data maps into the FOCUS view model:
 * paint catalog meta, the per-painter done-set, and the per-PAINT note
 * map. These tests pin that wiring — especially that each step's global
 * paint note follows the paint to EVERY occurrence, and that custom-mix
 * steps (no paint) carry null paintId / paintNote.
 */
import { describe, expect, test } from "vitest";
import {
  buildFocusZones,
  type FocusBundleZone,
  type FocusPaintMeta,
} from "@/lib/focus/rollup";

const PAINT_A = "citadel-mephiston-red";
const PAINT_B = "citadel-macragge-blue";

function step(
  over: Partial<FocusBundleZone["steps"][number]> & { id: string; zoneId: string },
): FocusBundleZone["steps"][number] {
  return {
    position: 0,
    technique: "basecoat",
    paintId: null,
    customColorHex: null,
    notesMd: null,
    notes: null,
    createdAt: new Date(),
    ...over,
  } as FocusBundleZone["steps"][number];
}

function zone(
  id: string,
  steps: ReadonlyArray<FocusBundleZone["steps"][number]>,
): FocusBundleZone {
  return {
    id,
    recipeId: "r1",
    position: 0,
    name: `Zone ${id}`,
    silhouetteZoneId: null,
    createdAt: new Date(),
    steps,
  } as FocusBundleZone;
}

const paintMeta: ReadonlyMap<string, FocusPaintMeta> = new Map([
  [PAINT_A, { hex: "#aa0033", label: "Citadel Mephiston Red" }],
  [PAINT_B, { hex: "#0033aa", label: "Citadel Macragge Blue" }],
]);

describe("buildFocusZones", () => {
  test("threads a paint's global note into the matching step", () => {
    const zones = [
      zone("z1", [step({ id: "s1", zoneId: "z1", paintId: PAINT_A })]),
    ];
    const out = buildFocusZones(
      zones,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "2 thin coats"]]),
    );
    expect(out[0]!.steps[0]!.paintId).toBe(PAINT_A);
    expect(out[0]!.steps[0]!.paintNote).toBe("2 thin coats");
    expect(out[0]!.steps[0]!.paintLabel).toBe("Citadel Mephiston Red");
  });

  test("the same note follows the paint to EVERY occurrence", () => {
    const zones = [
      zone("z1", [step({ id: "s1", zoneId: "z1", paintId: PAINT_A })]),
      zone("z2", [step({ id: "s2", zoneId: "z2", paintId: PAINT_A })]),
    ];
    const out = buildFocusZones(
      zones,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "edge highlight only"]]),
    );
    expect(out[0]!.steps[0]!.paintNote).toBe("edge highlight only");
    expect(out[1]!.steps[0]!.paintNote).toBe("edge highlight only");
  });

  test("a step whose paint has no note carries a null paintNote", () => {
    const zones = [
      zone("z1", [step({ id: "s1", zoneId: "z1", paintId: PAINT_B })]),
    ];
    const out = buildFocusZones(
      zones,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "only A has a note"]]),
    );
    expect(out[0]!.steps[0]!.paintNote).toBeNull();
  });

  test("a custom-mix step (no paint) gets null paintId + null paintNote", () => {
    const zones = [
      zone("z1", [
        step({ id: "s1", zoneId: "z1", paintId: null, customColorHex: "#5A9DD8" }),
      ]),
    ];
    const out = buildFocusZones(
      zones,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "irrelevant"]]),
    );
    expect(out[0]!.steps[0]!.paintId).toBeNull();
    expect(out[0]!.steps[0]!.paintNote).toBeNull();
    expect(out[0]!.steps[0]!.paintHex).toBe("#5A9DD8");
  });

  test("does NOT thread the per-step note into the view model (FOCUS notes are per-paint only)", () => {
    // Ross's 2026-06-02 locked call: the FOCUS scheme keeps ONLY the
    // per-paint note. The source RecipeStep still carries `notes`
    // (the column is non-destructively preserved), but buildFocusZones
    // must not surface it on the view model — only the paint note +
    // done-state thread through.
    const zones = [
      zone("z1", [
        step({ id: "s1", zoneId: "z1", paintId: PAINT_A, notes: "per-step note" }),
      ]),
    ];
    const out = buildFocusZones(
      zones,
      paintMeta,
      new Set(["s1"]),
      new Map([[PAINT_A, "per-paint note"]]),
    );
    const s = out[0]!.steps[0]!;
    expect(s).not.toHaveProperty("notes");
    expect(s.paintNote).toBe("per-paint note");
    expect(s.done).toBe(true);
  });
});
