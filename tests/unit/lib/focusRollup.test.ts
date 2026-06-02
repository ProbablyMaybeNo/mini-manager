/**
 * P15.0 — FOCUS header rollup helpers: project-state pill segments +
 * recipe completion percentage. Pure functions, no DB.
 */
import { describe, expect, test } from "vitest";
import {
  projectStatePill,
  projectStatePillText,
  recipeCompletionPercent,
} from "@/lib/focus/rollup";

describe("projectStatePill — stage breakdown segments", () => {
  test("maps the four cumulative stage counters to labelled segments", () => {
    const segs = projectStatePill({
      buildCount: 12,
      primeCount: 8,
      paintCount: 3,
      completeCount: 0,
    });
    expect(segs).toEqual([
      { key: "built", label: "BUILT", value: 12 },
      { key: "primed", label: "PRIMED", value: 8 },
      { key: "painted", label: "PAINTED", value: 3 },
      { key: "complete", label: "COMPLETE", value: 0 },
    ]);
  });

  test("renders the canonical mono-caps string", () => {
    const text = projectStatePillText({
      buildCount: 12,
      primeCount: 8,
      paintCount: 3,
      completeCount: 0,
    });
    expect(text).toBe("12 BUILT · 8 PRIMED · 3 PAINTED · 0 COMPLETE");
  });

  test("zero-everywhere renders all zeros, not an empty string", () => {
    const text = projectStatePillText({
      buildCount: 0,
      primeCount: 0,
      paintCount: 0,
      completeCount: 0,
    });
    expect(text).toBe("0 BUILT · 0 PRIMED · 0 PAINTED · 0 COMPLETE");
  });
});

describe("recipeCompletionPercent", () => {
  test("done / total as an integer percent", () => {
    expect(recipeCompletionPercent(1, 2)).toBe(50);
    expect(recipeCompletionPercent(2, 3)).toBe(67); // rounds 66.6
    expect(recipeCompletionPercent(0, 5)).toBe(0);
    expect(recipeCompletionPercent(5, 5)).toBe(100);
  });

  test("zero total steps reports 0 — no divide-by-zero", () => {
    expect(recipeCompletionPercent(0, 0)).toBe(0);
    expect(recipeCompletionPercent(3, 0)).toBe(0);
  });

  test("clamps a stale over-count to 100", () => {
    expect(recipeCompletionPercent(7, 5)).toBe(100);
  });

  test("clamps a negative done-count to 0", () => {
    expect(recipeCompletionPercent(-2, 5)).toBe(0);
  });
});
