/**
 * P15.x / 2026-06-04 unify — `buildFocusSlots` view-model builder.
 *
 * The dashboard threads three side-data maps into the FOCUS view model:
 * paint catalog meta, the per-painter done-set, and the per-PAINT note
 * map. These tests pin that wiring — especially that each slot's global
 * paint note follows the paint to EVERY occurrence, and that custom-mix
 * slots (no paint) carry null paintId / paintNote.
 */
import { describe, expect, test } from "vitest";
import {
  buildFocusSlots,
  type FocusPaintMeta,
} from "@/lib/focus/rollup";
import type { RecipeSlot } from "@/db/schema";

const PAINT_A = "citadel-mephiston-red";
const PAINT_B = "citadel-macragge-blue";

function slot(over: Partial<RecipeSlot> & { id: string }): RecipeSlot {
  return {
    recipeId: "r1",
    position: 0,
    technique: "basecoat",
    paintId: null,
    customColorHex: null,
    notesMd: null,
    notes: null,
    createdAt: new Date(),
    ...over,
  } as RecipeSlot;
}

const paintMeta: ReadonlyMap<string, FocusPaintMeta> = new Map([
  [PAINT_A, { hex: "#aa0033", label: "Citadel Mephiston Red" }],
  [PAINT_B, { hex: "#0033aa", label: "Citadel Macragge Blue" }],
]);

describe("buildFocusSlots", () => {
  test("threads a paint's global note into the matching slot", () => {
    const slots = [slot({ id: "s1", paintId: PAINT_A })];
    const out = buildFocusSlots(
      slots,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "2 thin coats"]]),
    );
    expect(out[0]!.paintId).toBe(PAINT_A);
    expect(out[0]!.paintNote).toBe("2 thin coats");
    expect(out[0]!.paintLabel).toBe("Citadel Mephiston Red");
  });

  test("the same note follows the paint to EVERY occurrence", () => {
    const slots = [
      slot({ id: "s1", paintId: PAINT_A }),
      slot({ id: "s2", paintId: PAINT_A, position: 1 }),
    ];
    const out = buildFocusSlots(
      slots,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "edge highlight only"]]),
    );
    expect(out[0]!.paintNote).toBe("edge highlight only");
    expect(out[1]!.paintNote).toBe("edge highlight only");
  });

  test("a slot whose paint has no note carries a null paintNote", () => {
    const slots = [slot({ id: "s1", paintId: PAINT_B })];
    const out = buildFocusSlots(
      slots,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "only A has a note"]]),
    );
    expect(out[0]!.paintNote).toBeNull();
  });

  test("a custom-mix slot (no paint) gets null paintId + null paintNote", () => {
    const slots = [
      slot({ id: "s1", paintId: null, customColorHex: "#5A9DD8" }),
    ];
    const out = buildFocusSlots(
      slots,
      paintMeta,
      new Set(),
      new Map([[PAINT_A, "irrelevant"]]),
    );
    expect(out[0]!.paintId).toBeNull();
    expect(out[0]!.paintNote).toBeNull();
    expect(out[0]!.paintHex).toBe("#5A9DD8");
  });

  test("does NOT thread the per-slot note into the view model (FOCUS notes are per-paint only)", () => {
    // Ross's 2026-06-02 locked call: the FOCUS scheme keeps ONLY the
    // per-paint note. The source slot still carries `notes` (the column
    // is non-destructively preserved), but buildFocusSlots must not
    // surface it on the view model — only the paint note + done-state
    // thread through.
    const slots = [slot({ id: "s1", paintId: PAINT_A, notes: "per-slot note" })];
    const out = buildFocusSlots(
      slots,
      paintMeta,
      new Set(["s1"]),
      new Map([[PAINT_A, "per-paint note"]]),
    );
    const s = out[0]!;
    expect(s).not.toHaveProperty("notes");
    expect(s.paintNote).toBe("per-paint note");
    expect(s.done).toBe(true);
  });
});
