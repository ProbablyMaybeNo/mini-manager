/**
 * deleteAccount — permanently removes the signed-in user and cascades to
 * all their owner-scoped data. Stripe isn't configured in tests (no
 * STRIPE_SECRET_KEY), so the cancellation branch is skipped and deletion
 * runs straight through. Real in-memory libsql DB with FKs enforced.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, type TestDb } from "../_helpers/testDb";
import { projectImages, projects, recipes, users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

const delMock = vi.hoisted(() =>
  vi.fn(async (_pathname: string, _opts?: unknown) => undefined),
);

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
vi.mock("@vercel/blob", () => ({ del: delMock }));

const { createProject } = await import("@/lib/actions/projects");
const { deleteAccount } = await import("@/lib/actions/account");

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  delMock.mockClear();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
  delete process.env.BLOB_READ_WRITE_TOKEN;
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

  test("deletes the user's Vercel Blob objects (project images + gallery cards)", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const created = await createProject({ name: "Photo", type: "Unit", count: 1 });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.data) return;
    const projectId = created.data.id;

    await state.db!.insert(projectImages).values({
      id: nanoid(16),
      projectId,
      ownerId: state.userId,
      url: "https://teststore.public.blob.vercel-storage.com/project-images/x/1.png",
      pathname: "project-images/x/1.png",
    });

    await state.db!.insert(recipes).values({
      id: nanoid(16),
      ownerId: state.userId,
      name: "Gallery Recipe",
      bodyType: "infantry",
      isStandalone: true,
      galleryImageUrl:
        "https://teststore.public.blob.vercel-storage.com/gallery-cards/x/1.png",
      galleryImagePathname: "gallery-cards/x/1.png",
    });

    const res = await deleteAccount();
    expect(res.ok).toBe(true);

    // Both blob objects were del()'d, by pathname.
    const deleted = delMock.mock.calls.map((c) => c[0]);
    expect(deleted).toContain("project-images/x/1.png");
    expect(deleted).toContain("gallery-cards/x/1.png");
    expect(delMock).toHaveBeenCalledTimes(2);
  });

  test("skips blob deletion entirely when Blob is not configured", async () => {
    // No BLOB_READ_WRITE_TOKEN — deleteUserBlobs must short-circuit.
    await createProject({ name: "NoBlob", type: "Unit", count: 1 });
    const res = await deleteAccount();
    expect(res.ok).toBe(true);
    expect(delMock).not.toHaveBeenCalled();
  });
});
