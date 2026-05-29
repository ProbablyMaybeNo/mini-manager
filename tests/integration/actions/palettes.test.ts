import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { palettes } from "@/db/schema";

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

const { createPalette, deletePalette, renamePalette } = await import(
  "@/lib/actions/palettes"
);

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("createPalette", () => {
  test("persists normalised hexes and null-filled paintIds as JSON", async () => {
    const res = await createPalette({
      name: "Triadic Red",
      source: "wheel",
      colorHexes: ["#0e4a8a", "33ff66"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const [row] = await state.db!
      .select()
      .from(palettes)
      .where(eq(palettes.id, res.data.id));
    expect(row!.name).toBe("Triadic Red");
    expect(row!.source).toBe("wheel");
    expect(JSON.parse(row!.colorHexes)).toEqual(["#0E4A8A", "#33FF66"]);
    expect(JSON.parse(row!.paintIds)).toEqual([null, null]);
  });

  test("stores supplied paintIds aligned to the colours", async () => {
    const res = await createPalette({
      name: "Pinned",
      source: "match",
      colorHexes: ["#000000", "#ffffff"],
      paintIds: ["citadel-abaddon-black", null],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [row] = await state.db!
      .select()
      .from(palettes)
      .where(eq(palettes.id, res.data.id));
    expect(JSON.parse(row!.paintIds)).toEqual(["citadel-abaddon-black", null]);
  });

  test("rejects an empty name", async () => {
    const res = await createPalette({
      name: "  ",
      source: "wheel",
      colorHexes: ["#000000"],
    });
    expect(res.ok).toBe(false);
  });

  test("rejects a malformed hex", async () => {
    const res = await createPalette({
      name: "Bad",
      source: "wheel",
      colorHexes: ["#000000", "nope"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Invalid hex/);
  });

  test("rejects an empty colour list", async () => {
    const res = await createPalette({
      name: "Empty",
      source: "wheel",
      colorHexes: [],
    });
    expect(res.ok).toBe(false);
  });
});

describe("renamePalette", () => {
  async function seed(): Promise<string> {
    const res = await createPalette({
      name: "Before",
      source: "eyedropper",
      colorHexes: ["#0E4A8A"],
    });
    if (!res.ok) throw new Error("seed failed");
    return res.data.id;
  }

  test("renames an owned palette", async () => {
    const id = await seed();
    const res = await renamePalette({ id, name: "After" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.name).toBe("After");
  });

  test("cannot rename another user's palette", async () => {
    const id = await seed();
    state.userId = await seedExtraUser(state.db!);
    const res = await renamePalette({ id, name: "Hijacked" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Palette not found/);
  });
});

describe("deletePalette", () => {
  test("removes an owned palette", async () => {
    const created = await createPalette({
      name: "Doomed",
      source: "gradient",
      colorHexes: ["#0E4A8A"],
    });
    if (!created.ok) throw new Error("seed failed");
    const res = await deletePalette({ id: created.data.id });
    expect(res.ok).toBe(true);
    expect(await state.db!.select().from(palettes)).toHaveLength(0);
  });

  test("cannot delete another user's palette", async () => {
    const created = await createPalette({
      name: "Mine",
      source: "manual",
      colorHexes: ["#0E4A8A"],
    });
    if (!created.ok) throw new Error("seed failed");
    state.userId = await seedExtraUser(state.db!);
    const res = await deletePalette({ id: created.data.id });
    expect(res.ok).toBe(false);
    expect(await state.db!.select().from(palettes)).toHaveLength(1);
  });
});
