import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { namedModels, projects } from "@/db/schema";

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
vi.mock("@/lib/auth-stub", () => ({
  currentUserId: async () => state.userId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createNamedModel, toggleNamedModelStage, deleteNamedModel } =
  await import("@/lib/actions/namedModels");
const { applyToggle } = await import("@/lib/namedModels/cascade");

async function seedProject(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    type: "Unit",
    name: "Squad",
    count: 10,
  });
  return id;
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("applyToggle — pure cascade logic", () => {
  const empty = {
    isBuilt: false,
    isPrimed: false,
    isPainted: false,
    isBased: false,
    isComplete: false,
  };
  const built = { ...empty, isBuilt: true };
  const builtPrimed = { ...built, isPrimed: true };

  test("ticking the first stage from empty succeeds", () => {
    const r = applyToggle(empty, "isBuilt", true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.isBuilt).toBe(true);
  });

  test("ticking a later stage when earlier ones are unticked is rejected with a helpful message", () => {
    const r = applyToggle(empty, "isPainted", true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Tick Built first/);
  });

  test("ticking a stage when all prior are on succeeds", () => {
    const r = applyToggle(builtPrimed, "isPainted", true);
    expect(r.ok).toBe(true);
  });

  test("unticking a stage cascades all later stages off", () => {
    const everything = {
      isBuilt: true,
      isPrimed: true,
      isPainted: true,
      isBased: true,
      isComplete: true,
    };
    const r = applyToggle(everything, "isPrimed", false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch).toEqual({
        isBuilt: true,
        isPrimed: false,
        isPainted: false,
        isBased: false,
        isComplete: false,
      });
    }
  });
});

describe("createNamedModel", () => {
  test("appends with monotonic position", async () => {
    const projectId = await seedProject();
    await createNamedModel({ projectId, name: "Sergeant" });
    await createNamedModel({ projectId, name: "Apothecary" });

    const rows = await state
      .db!.select()
      .from(namedModels)
      .where(eq(namedModels.projectId, projectId));
    expect(rows).toHaveLength(2);
    const positions = rows.map((r) => r.position).sort();
    expect(positions).toEqual([0, 1]);
  });

  test("rejects a project the user doesn't own", async () => {
    const otherUserId = await seedExtraUser(state.db!);
    const otherProjectId = nanoid(16);
    await state.db!.insert(projects).values({
      id: otherProjectId,
      ownerId: otherUserId,
      type: "Unit",
      name: "Other",
      count: 5,
    });
    const res = await createNamedModel({
      projectId: otherProjectId,
      name: "Hijack",
    });
    expect(res.ok).toBe(false);
  });
});

describe("toggleNamedModelStage — DB round-trip", () => {
  test("ticking Built persists", async () => {
    const projectId = await seedProject();
    const created = await createNamedModel({ projectId, name: "Vraks" });
    if (!created.ok) throw new Error("setup failed");

    await toggleNamedModelStage({
      id: created.data.id,
      stage: "isBuilt",
      nextValue: true,
    });

    const [row] = await state
      .db!.select()
      .from(namedModels)
      .where(eq(namedModels.id, created.data.id));
    expect(row!.isBuilt).toBe(true);
    expect(row!.isPrimed).toBe(false);
  });

  test("ticking Painted without Primed returns a friendly error and writes nothing", async () => {
    const projectId = await seedProject();
    const created = await createNamedModel({ projectId, name: "Vraks" });
    if (!created.ok) throw new Error("setup failed");

    const res = await toggleNamedModelStage({
      id: created.data.id,
      stage: "isPainted",
      nextValue: true,
    });
    expect(res.ok).toBe(false);

    const [row] = await state
      .db!.select()
      .from(namedModels)
      .where(eq(namedModels.id, created.data.id));
    expect(row!.isPainted).toBe(false);
  });

  test("un-ticking Primed cascades Painted/Based/Complete off", async () => {
    const projectId = await seedProject();
    const created = await createNamedModel({ projectId, name: "Vraks" });
    if (!created.ok) throw new Error("setup failed");

    // Walk up the cascade.
    for (const stage of ["isBuilt", "isPrimed", "isPainted", "isBased"] as const) {
      const r = await toggleNamedModelStage({
        id: created.data.id,
        stage,
        nextValue: true,
      });
      expect(r.ok).toBe(true);
    }

    const r = await toggleNamedModelStage({
      id: created.data.id,
      stage: "isPrimed",
      nextValue: false,
    });
    expect(r.ok).toBe(true);

    const [row] = await state
      .db!.select()
      .from(namedModels)
      .where(eq(namedModels.id, created.data.id));
    expect(row!.isBuilt).toBe(true);
    expect(row!.isPrimed).toBe(false);
    expect(row!.isPainted).toBe(false);
    expect(row!.isBased).toBe(false);
  });
});

describe("deleteNamedModel", () => {
  test("removes a row owned by the user", async () => {
    const projectId = await seedProject();
    const created = await createNamedModel({ projectId, name: "Doomed" });
    if (!created.ok) throw new Error("setup failed");

    await deleteNamedModel({ id: created.data.id });

    const rows = await state.db!.select().from(namedModels);
    expect(rows).toHaveLength(0);
  });

  test("rejects deletion by another user", async () => {
    const projectId = await seedProject();
    const created = await createNamedModel({ projectId, name: "Mine" });
    if (!created.ok) throw new Error("setup failed");

    state.userId = "intruder";
    const res = await deleteNamedModel({ id: created.data.id });
    expect(res.ok).toBe(false);

    const rows = await state.db!.select().from(namedModels);
    expect(rows).toHaveLength(1);
  });
});
