import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects } from "@/db/schema";
import type { Project } from "@/lib/types";

/**
 * Audit B2 — a container project's STATUS must come from the same aggregated
 * subtree its completion bar comes from.
 *
 * `mapProject` used to read `displayStatus(p)` off the container's own row.
 * A container's own `count` is 0 (its models live in its children), so the
 * `count === 0 → WISHLIST` branch labelled every Army and Warband WISHLIST no
 * matter how painted it was — while the bar beside it, built from the
 * aggregate, showed 43%. Status drives the roster filter and sort, so this was
 * not cosmetic: a part-painted army filtered as "not owned yet".
 *
 * These go through the real loader rather than the helper so a regression in
 * the wiring — not just in `displayStatus` — is what fails.
 */

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

vi.mock("@/db/client", () => ({
  get db() {
    if (!state.db) throw new Error("Test DB not initialised in beforeEach");
    return state.db;
  },
}));

const { loadAppData } = await import("@/lib/appData");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

/** Insert a project row directly — the counters are the whole point here, so
 *  set them explicitly instead of driving the stage-bump actions. */
async function insertProject(row: {
  id: string;
  name: string;
  type: "Army" | "Unit";
  parentId?: string;
  count?: number;
  ownedCount?: number;
  buildCount?: number;
  primeCount?: number;
  paintCount?: number;
  baseCount?: number;
  completeCount?: number;
  isShelved?: boolean;
}) {
  await state.db!.insert(projects).values({
    id: row.id,
    ownerId: state.userId,
    name: row.name,
    type: row.type,
    parentId: row.parentId ?? null,
    count: row.count ?? 0,
    ownedCount: row.ownedCount ?? 0,
    buildCount: row.buildCount ?? 0,
    primeCount: row.primeCount ?? 0,
    paintCount: row.paintCount ?? 0,
    baseCount: row.baseCount ?? 0,
    completeCount: row.completeCount ?? 0,
    isShelved: row.isShelved ?? false,
  });
}

function findById(list: Project[], id: string): Project | null {
  for (const p of list) {
    if (p.id === id) return p;
    const hit = p.children ? findById(p.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

describe("container project status (audit B2)", () => {
  test("an army whose units are part-painted is never WISHLIST", async () => {
    await insertProject({ id: "army", name: "Army 1", type: "Army" });
    // Five units of ten, every model based but not finished — the exact shape
    // the audit screenshotted as "50 models | WISHLIST | 43%".
    for (let i = 0; i < 5; i++) {
      await insertProject({
        id: `unit-${i}`,
        name: `Unit ${i}`,
        type: "Unit",
        parentId: "army",
        count: 10,
        ownedCount: 10,
        buildCount: 10,
        primeCount: 10,
        paintCount: 10,
        baseCount: 10,
      });
    }

    const data = await loadAppData(state.userId);
    const army = findById(data.projects ?? [], "army");

    expect(army).not.toBeNull();
    expect(army!.modelCount).toBe(50);
    expect(army!.completionPercent).toBeGreaterThan(0);
    expect(army!.status).not.toBe("WISHLIST");
    expect(army!.status).toBe("BASING");
  });

  test("an army whose units are all complete reads COMPLETE", async () => {
    await insertProject({ id: "army", name: "Done", type: "Army" });
    await insertProject({
      id: "unit",
      name: "Unit",
      type: "Unit",
      parentId: "army",
      count: 4,
      ownedCount: 4,
      buildCount: 4,
      primeCount: 4,
      paintCount: 4,
      baseCount: 4,
      completeCount: 4,
    });

    const data = await loadAppData(state.userId);
    expect(findById(data.projects ?? [], "army")!.status).toBe("COMPLETE");
  });

  test("an empty container is still WISHLIST — nothing owned to report", async () => {
    await insertProject({ id: "army", name: "Planned", type: "Army" });
    await insertProject({
      id: "unit",
      name: "Unit",
      type: "Unit",
      parentId: "army",
      count: 0,
    });

    const data = await loadAppData(state.userId);
    expect(findById(data.projects ?? [], "army")!.status).toBe("WISHLIST");
  });

  test("SHELVED still comes from the container's own row, not the subtree", async () => {
    await insertProject({ id: "army", name: "On hold", type: "Army", isShelved: true });
    await insertProject({
      id: "unit",
      name: "Unit",
      type: "Unit",
      parentId: "army",
      count: 6,
      ownedCount: 6,
      buildCount: 6,
      paintCount: 3,
    });

    const data = await loadAppData(state.userId);
    expect(findById(data.projects ?? [], "army")!.status).toBe("SHELVED");
  });

  test("a leaf unit is unaffected — its aggregate is its own row", async () => {
    await insertProject({
      id: "solo",
      name: "Solo unit",
      type: "Unit",
      count: 3,
      ownedCount: 3,
      buildCount: 1,
    });

    const data = await loadAppData(state.userId);
    expect(findById(data.projects ?? [], "solo")!.status).toBe("BUILDING");
  });
});
