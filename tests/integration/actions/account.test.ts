/**
 * deleteAccount — permanently removes the signed-in user and cascades to
 * all their owner-scoped data. Stripe isn't configured in tests (no
 * STRIPE_SECRET_KEY), so the cancellation branch is skipped and deletion
 * runs straight through. Real in-memory libsql DB with FKs enforced.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projects, users } from "@/db/schema";

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
const { deleteAccount } = await import("@/lib/actions/account");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("deleteAccount", () => {
  test("removes the user row and cascades their data", async () => {
    await createProject({ name: "Doomed Squad", type: "Unit", count: 5 });
    const before = await state.db!.select().from(projects);
    expect(before).toHaveLength(1);

    const res = await deleteAccount();
    expect(res.ok).toBe(true);

    const userRows = await state
      .db!.select()
      .from(users)
      .where(eq(users.id, state.userId));
    expect(userRows).toHaveLength(0);

    // Owner-scoped rows cascade away with the user.
    const after = await state.db!.select().from(projects);
    expect(after).toHaveLength(0);
  });

  test("does not touch another user's data", async () => {
    // Seed a project for the current user, then a second user with their own.
    await createProject({ name: "Mine", type: "Unit", count: 1 });
    const otherId = "other-user-keepme";
    await state.db!.insert(users).values({ id: otherId, email: "other@example.com" });
    await state.db!.insert(projects).values({
      ownerId: otherId,
      name: "Theirs",
      type: "Unit",
      count: 1,
    });

    const res = await deleteAccount();
    expect(res.ok).toBe(true);

    const survivors = await state.db!.select().from(projects);
    expect(survivors).toHaveLength(1);
    expect(survivors[0]!.name).toBe("Theirs");
    const otherUser = await state
      .db!.select()
      .from(users)
      .where(eq(users.id, otherId));
    expect(otherUser).toHaveLength(1);
  });
});
