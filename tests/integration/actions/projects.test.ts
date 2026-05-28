import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects } from "@/db/schema";

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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { createProject } = await import("@/lib/actions/projects");
const { redirect } = await import("next/navigation");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  vi.mocked(redirect).mockClear();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("createProject", () => {
  test("inserts a row and redirects to the new workspace", async () => {
    await createProject({ name: "Test Unit", type: "Unit", count: 10 });

    const rows = await state.db!.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("Test Unit");
    expect(rows[0]!.count).toBe(10);
    expect(rows[0]!.ownerId).toBe(state.userId);
    expect(vi.mocked(redirect)).toHaveBeenCalledWith(`/projects/${rows[0]!.id}`);
  });

  test("rejects empty name", async () => {
    const res = await createProject({ name: "  ", type: "Unit", count: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Name is required/);
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("Single Model forces count=1 regardless of input", async () => {
    await createProject({ name: "Hero", type: "Single Model", count: 99 });
    const [row] = await state.db!.select().from(projects);
    expect(row!.count).toBe(1);
  });

  test("rejects negative count", async () => {
    const res = await createProject({ name: "Foo", type: "Unit", count: -3 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Count cannot be negative/);
  });

  test("happy path nesting: Unit inside an Army", async () => {
    await createProject({ name: "My Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    await createProject({
      name: "Tactical Squad",
      type: "Unit",
      count: 10,
      parentId: army!.id,
    });

    const child = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.name, "Tactical Squad"));
    expect(child[0]!.parentId).toBe(army!.id);
  });

  test("rejects parent that isn't Army or Warband", async () => {
    await createProject({ name: "A Unit", type: "Unit", count: 10 });
    const [unit] = await state.db!.select().from(projects);

    const res = await createProject({
      name: "Sub",
      type: "Single Model",
      count: 1,
      parentId: unit!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Only Army or Warband/);
  });

  test("rejects 3-deep nesting", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);
    await createProject({
      name: "Sub-Army",
      type: "Army",
      count: 0,
      parentId: army!.id,
    });
    const [sub] = await state
      .db!.select()
      .from(projects)
      .where(eq(projects.parentId, army!.id));

    const res = await createProject({
      name: "Unit",
      type: "Unit",
      count: 5,
      parentId: sub!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Maximum 3 levels/);
  });

  test("rejects parent owned by a different user", async () => {
    await createProject({ name: "Army", type: "Army", count: 0 });
    const [army] = await state.db!.select().from(projects);

    state.userId = "different-user";
    const res = await createProject({
      name: "Unit",
      type: "Unit",
      count: 5,
      parentId: army!.id,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Parent project not found/);
  });
});
