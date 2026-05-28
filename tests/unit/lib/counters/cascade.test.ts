import { describe, expect, test } from "vitest";
import {
  validateBump,
  counterStages,
  type CounterSnapshot,
} from "@/lib/counters/cascade";

const snap = (overrides: Partial<CounterSnapshot> = {}): CounterSnapshot => ({
  count: 20,
  ownedCount: 10,
  buildCount: 8,
  primeCount: 6,
  paintCount: 4,
  baseCount: 2,
  completeCount: 1,
  ...overrides,
});

describe("validateBump — cascade enforcement", () => {
  test("incrementing a stage at its ceiling fails", () => {
    // build === owned → can't increment build
    const s = snap({ buildCount: 10 });
    const r = validateBump(s, "build", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/can't exceed Owned/);
  });

  test("incrementing a stage below its ceiling succeeds", () => {
    const r = validateBump(snap(), "paint", 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextValue).toBe(5);
  });

  test("decrementing a stage at its floor fails", () => {
    // paint === prime → decrementing prime would drop it below paint
    const s = snap({ paintCount: 6 });
    const r = validateBump(s, "prime", -1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/can't drop below Paint/);
  });

  test("decrementing below 0 fails", () => {
    const s = snap({
      ownedCount: 0,
      buildCount: 0,
      primeCount: 0,
      paintCount: 0,
      baseCount: 0,
      completeCount: 0,
    });
    const r = validateBump(s, "complete", -1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/can't go below 0/);
  });

  test("owned is ceilinged by count", () => {
    const s = snap({ ownedCount: 20 });
    const r = validateBump(s, "owned", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Count/);
  });

  test("complete has no floor — can always drop to 0", () => {
    const s = snap({ completeCount: 1 });
    const r = validateBump(s, "complete", -1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextValue).toBe(0);
  });

  test("counterStages enumerates exactly the bumpable stages", () => {
    expect(counterStages).toEqual([
      "owned",
      "build",
      "prime",
      "paint",
      "base",
      "complete",
    ]);
  });
});
