import { describe, expect, test } from "vitest";
import {
  aggregateCounters,
  displayStatus,
  isLeafProject,
  progressPercent,
} from "@/lib/progress";
import type { NamedModel, Project } from "@/db/schema";

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

const namedModel = (overrides: Partial<NamedModel> = {}): NamedModel =>
  ({
    id: "n1",
    projectId: "proj1",
    position: 0,
    name: "Sergeant",
    isBuilt: false,
    isPrimed: false,
    isPainted: false,
    isBased: false,
    isComplete: false,
    recipeOverrideId: null,
    notesMd: null,
    referenceImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as NamedModel;

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

  test("named-model contributions add to the score", () => {
    const fullyPaintedNamed = namedModel({
      isBuilt: true,
      isPrimed: true,
      isPainted: true,
      isBased: true,
      isComplete: true,
    });
    // count=0, 1 named model fully done = 5 booleans × 20 / 1 model = 100%
    expect(progressPercent(projectStub({ count: 0 }), [fullyPaintedNamed])).toBe(100);
  });

  test("count=0 with no named models is 0%, not NaN", () => {
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

  test("named-model totals roll up via the optional map", () => {
    const root = projectStub({ id: "army", count: 0 });
    const child = projectStub({ id: "u1", count: 10 });
    const agg = aggregateCounters(root, [child], { army: 1, u1: 3 });
    expect(agg.namedModelCount).toBe(4);
  });
});

describe("isLeafProject", () => {
  test("count > 0 → leaf", () => {
    expect(isLeafProject({ count: 10 })).toBe(true);
  });
  test("count === 0 and no named models → not a leaf (Army container)", () => {
    expect(isLeafProject({ count: 0 })).toBe(false);
  });
  test("count === 0 but with named models → still a leaf", () => {
    expect(isLeafProject({ count: 0 }, 2)).toBe(true);
  });
});

describe("displayStatus", () => {
  test("shelved beats everything else", () => {
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
    ).toBe("Shelved");
  });
  test("count === 0 → New", () => {
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
    ).toBe("New");
  });
  test("Pile = owned but nothing built", () => {
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
    ).toBe("Pile");
  });
  test("most-advanced stage wins", () => {
    const base = {
      count: 10,
      ownedCount: 10,
      buildCount: 10,
      primeCount: 10,
      paintCount: 5,
      baseCount: 0,
      completeCount: 0,
      isShelved: false,
    };
    expect(displayStatus(base)).toBe("Painting");
  });
  test("complete_count === count → Completed", () => {
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
    ).toBe("Completed");
  });
});
