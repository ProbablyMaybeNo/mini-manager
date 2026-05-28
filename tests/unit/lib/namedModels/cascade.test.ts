import { describe, expect, test } from "vitest";
import {
  applyToggle,
  labelFor,
  namedModelStages,
  type NamedModelStageSnapshot,
} from "@/lib/namedModels/cascade";

const ALL_OFF: NamedModelStageSnapshot = {
  isBuilt: false,
  isPrimed: false,
  isPainted: false,
  isBased: false,
  isComplete: false,
};

const ALL_ON: NamedModelStageSnapshot = {
  isBuilt: true,
  isPrimed: true,
  isPainted: true,
  isBased: true,
  isComplete: true,
};

describe("labelFor", () => {
  test("maps every stage to a human label", () => {
    expect(namedModelStages.map(labelFor)).toEqual([
      "Built",
      "Primed",
      "Painted",
      "Based",
      "Complete",
    ]);
  });
});

describe("applyToggle — toggling ON", () => {
  test("the lowest stage can be ticked from all-off", () => {
    const res = applyToggle(ALL_OFF, "isBuilt", true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.patch.isBuilt).toBe(true);
    expect(res.patch.isPrimed).toBe(false);
  });

  test("ticking a higher stage requires every prior stage on", () => {
    const res = applyToggle(ALL_OFF, "isPainted", true);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Tick Built first/);
  });

  test("names the nearest missing prerequisite", () => {
    const builtOnly: NamedModelStageSnapshot = { ...ALL_OFF, isBuilt: true };
    const res = applyToggle(builtOnly, "isPainted", true);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Tick Primed first/);
  });

  test("ticking the top stage succeeds when all priors are on", () => {
    const upToBased: NamedModelStageSnapshot = {
      isBuilt: true,
      isPrimed: true,
      isPainted: true,
      isBased: true,
      isComplete: false,
    };
    const res = applyToggle(upToBased, "isComplete", true);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.patch.isComplete).toBe(true);
  });
});

describe("applyToggle — toggling OFF", () => {
  test("unticking a mid stage cascades the untick upward", () => {
    const res = applyToggle(ALL_ON, "isPrimed", false);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.patch).toEqual({
      isBuilt: true,
      isPrimed: false,
      isPainted: false,
      isBased: false,
      isComplete: false,
    });
  });

  test("unticking the lowest stage clears everything", () => {
    const res = applyToggle(ALL_ON, "isBuilt", false);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.patch).toEqual(ALL_OFF);
  });

  test("unticking the top stage leaves the rest intact", () => {
    const res = applyToggle(ALL_ON, "isComplete", false);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.patch).toEqual({ ...ALL_ON, isComplete: false });
  });
});

describe("applyToggle — guards", () => {
  test("rejects an unknown stage", () => {
    const res = applyToggle(ALL_OFF, "isFlocked" as never, true);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/Unknown stage/);
  });

  test("does not mutate the input snapshot", () => {
    const snap: NamedModelStageSnapshot = { ...ALL_ON };
    applyToggle(snap, "isPrimed", false);
    expect(snap).toEqual(ALL_ON);
  });
});
