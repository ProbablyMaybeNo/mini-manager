import { describe, expect, test } from "vitest";
import {
  validateBump,
  counterStages,
  STAGE_COLUMN,
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

describe("validateBump — bounds only, no stage ordering", () => {
  test("a stage can pass the one before it", () => {
    // build === owned. Under the old cascade this was "can't exceed Owned";
    // it's the exact wall Ross hit — a unit created at PRIMED had owned=1,
    // and no screen in the app can raise owned.
    const s = snap({ buildCount: 10 });
    const r = validateBump(s, "build", 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextValue).toBe(11);
  });

  test("a stage can be raised from zero with every earlier stage at zero", () => {
    // "I primed them all, never touched the build tracker" — legal now.
    const s = snap({
      count: 4,
      ownedCount: 0,
      buildCount: 0,
      primeCount: 0,
      paintCount: 0,
      baseCount: 0,
      completeCount: 0,
    });
    const r = validateBump(s, "prime", 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextValue).toBe(1);
  });

  test("incrementing below the model count succeeds", () => {
    const r = validateBump(snap(), "paint", 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextValue).toBe(5);
  });

  test("a stage can be dropped below the one after it", () => {
    // paint === prime → the old cascade refused to lower prime.
    const s = snap({ paintCount: 6 });
    const r = validateBump(s, "prime", -1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.nextValue).toBe(5);
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

  test("every stage is ceilinged by the model count", () => {
    for (const stage of counterStages) {
      const s = snap({ count: 20, [STAGE_COLUMN[stage]]: 20 });
      const r = validateBump(s, stage, 1);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/can't exceed the model count \(20\)/);
    }
  });

  test("complete can always drop to 0", () => {
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
