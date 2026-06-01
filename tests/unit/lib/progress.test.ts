import { describe, expect, test } from "vitest";
import {
  aggregateCounters,
  displayStatus,
  isLeafProject,
  progressPercent,
} from "@/lib/progress";
import type { Project } from "@/db/schema";

const projectStub = (overrides: Partial<Project> = {}): Project =>
  ({
    id: "proj1",
    ownerId: "u1",
    parentId: null,
    type: "Unit",
    name: "Test",
    count: 0,
    ownedCount: 0,
    buildCount: 0,
    primeCount: 0,
    paintCount: 0,
    baseCount: 0,
    completeCount: 0,
    isShelved: false,
    faction: null,
    priority: "Medium",
    targetDate: null,
    pointsValue: null,
    notesMd: null,
    referenceImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    ...overrides,
  }) as Project;

describe("progressPercent", () => {
  test("untouched unit is 0%", () => {
    expect(progressPercent(projectStub({ count: 20 }))).toBe(0);
  });

  test("V2-BUILD-PLAN canonical example: 10/5/3/1/1 of 20 = 20%", () => {
    expect(
      progressPercent(
        projectStub({
          count: 20,
          buildCount: 10,
          primeCount: 5,
          paintCount: 3,
          baseCount: 1,
          completeCount: 1,
        }),
      ),
    ).toBe(20);
  });

  test("fully complete unit is 100%", () => {
    expect(
      progressPercent(
        projectStub({
          count: 10,
          buildCount: 10,
          primeCount: 10,
          paintCount: 10,
          baseCount: 10,
          completeCount: 10,
        }),
      ),
    ).toBe(100);
  });

  test("count=0 is 0%, not NaN (P13.4 — named models no longer contribute)", () => {
    expect(progressPercent(projectStub({ count: 0 }))).toBe(0);
  });
});

describe("aggregateCounters — Army roll-up", () => {
  test("sums root + descendants", () => {
    const root = projectStub({ id: "army", count: 0, ownedCount: 0 });
    const child1 = projectStub({
      id: "u1",
      count: 10,
      ownedCount: 10,
      buildCount: 10,
      primeCount: 6,
      paintCount: 3,
      baseCount: 1,
      completeCount: 0,
    });
    const child2 = projectStub({
      id: "u2",
      count: 20,
      ownedCount: 12,
      buildCount: 8,
      primeCount: 4,
      paintCount: 2,
      baseCount: 0,
      completeCount: 0,
    });
    const agg = aggregateCounters(root, [child1, child2]);
    expect(agg.count).toBe(30);
    expect(agg.ownedCount).toBe(22);
    expect(agg.buildCount).toBe(18);
    expect(agg.primeCount).toBe(10);
    expect(agg.paintCount).toBe(5);
    expect(agg.baseCount).toBe(1);
    expect(agg.completeCount).toBe(0);
  });

});

describe("isLeafProject", () => {
  test("count > 0 → leaf", () => {
    expect(isLeafProject({ count: 10 })).toBe(true);
  });
  test("count === 0 → not a leaf (Army container)", () => {
    expect(isLeafProject({ count: 0 })).toBe(false);
  });
});

describe("displayStatus — Phase-12 locked status set", () => {
  test("shelved beats everything else (SHELVED)", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 10,
        completeCount: 10,
        isShelved: true,
      }),
    ).toBe("SHELVED");
  });
  test("count === 0 → WISHLIST", () => {
    expect(
      displayStatus({
        count: 0,
        ownedCount: 0,
        buildCount: 0,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        isShelved: false,
      }),
    ).toBe("WISHLIST");
  });
  test("PURCHASED = ownedCount > 0 but nothing built", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 0,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        isShelved: false,
      }),
    ).toBe("PURCHASED");
  });
  test("BUILDING = buildCount > 0, nothing primed", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 3,
        primeCount: 0,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        isShelved: false,
      }),
    ).toBe("BUILDING");
  });
  test("PRIMING = primeCount > 0, nothing painted", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 5,
        paintCount: 0,
        baseCount: 0,
        completeCount: 0,
        isShelved: false,
      }),
    ).toBe("PRIMING");
  });
  test("most-advanced stage wins: PAINTING beats PRIMING", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 5,
        baseCount: 0,
        completeCount: 0,
        isShelved: false,
      }),
    ).toBe("PAINTING");
  });
  test("BASING = baseCount > 0, not all complete", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 3,
        completeCount: 0,
        isShelved: false,
      }),
    ).toBe("BASING");
  });
  test("complete_count === count → COMPLETE", () => {
    expect(
      displayStatus({
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 10,
        completeCount: 10,
        isShelved: false,
      }),
    ).toBe("COMPLETE");
  });
});
