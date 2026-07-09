/**
 * Recipe-card phase 1 — project model-photo actions. A project node owns a
 * flat, position-ordered list of uploaded photos; `recordProjectImage`
 * persists a completed client upload, `deleteProjectImage` removes the row
 * + calls Blob `del()`, `reorderProjectImages` persists a new carousel
 * order. Every mutation is ownership-scoped. Runs against a real
 * in-memory libsql DB with all migrations applied (so project_image
 * exists); Vercel Blob's `del()` is mocked — this suite never hits the
 * network or requires a real BLOB_READ_WRITE_TOKEN.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { projectImages } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

const delMock = vi.hoisted(() => vi.fn(async () => undefined));

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
const {
  recordProjectImage,
  deleteProjectImage,
  reorderProjectImages,
  loadProjectImages,
} = await import("@/lib/actions/projectImages");
const { listProjectImages, countProjectImages } = await import(
  "@/db/queries/projectImages"
);

async function seedProject(): Promise<string> {
  const res = await createProject({ name: "Test Unit", type: "Unit", count: 5 });
  if (!res.ok) throw new Error("project seed failed");
  return res.data.id;
}

async function rowsFor(projectId: string) {
  return state.db!
    .select()
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId))
    .orderBy(asc(projectImages.position));
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  delMock.mockClear();
});

afterEach(() => {
  state.db = null;
  state.userId = "";
});

describe("recordProjectImage", () => {
  test("inserts a row with an incrementing position", async () => {
    const projectId = await seedProject();
    const a = await recordProjectImage({
      projectId,
      url: "https://blob.example/a.webp",
      pathname: "project-images/a.webp",
    });
    const b = await recordProjectImage({
      projectId,
      url: "https://blob.example/b.webp",
      pathname: "project-images/b.webp",
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const rows = await rowsFor(projectId);
    expect(rows.map((r) => r.position)).toEqual([0, 1]);
    expect(rows.map((r) => r.pathname)).toEqual([
      "project-images/a.webp",
      "project-images/b.webp",
    ]);
    expect(rows.every((r) => r.ownerId === state.userId)).toBe(true);
  });

  test("rejects a project the user does not own", async () => {
    const projectId = await seedProject();
    state.userId = await seedExtraUser(state.db!, "intruder");
    const res = await recordProjectImage({
      projectId,
      url: "https://blob.example/a.webp",
      pathname: "project-images/a.webp",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Project not found/);
  });

  test("rejects an invalid URL", async () => {
    const projectId = await seedProject();
    const res = await recordProjectImage({
      projectId,
      url: "not a url",
      pathname: "project-images/a.webp",
    });
    expect(res.ok).toBe(false);
  });

  test("enforces the per-project image cap", async () => {
    const projectId = await seedProject();
    for (let i = 0; i < 12; i++) {
      const res = await recordProjectImage({
        projectId,
        url: `https://blob.example/${i}.webp`,
        pathname: `project-images/${i}.webp`,
      });
      expect(res.ok).toBe(true);
    }
    expect(await countProjectImages(projectId)).toBe(12);

    const overCap = await recordProjectImage({
      projectId,
      url: "https://blob.example/13.webp",
      pathname: "project-images/13.webp",
    });
    expect(overCap.ok).toBe(false);
    if (!overCap.ok) expect(overCap.error).toMatch(/maximum of 12/);
    expect(await countProjectImages(projectId)).toBe(12);
  });
});

describe("deleteProjectImage", () => {
  test("removes the row and calls blob del() with the pathname", async () => {
    const projectId = await seedProject();
    const added = await recordProjectImage({
      projectId,
      url: "https://blob.example/doomed.webp",
      pathname: "project-images/doomed.webp",
    });
    if (!added.ok) throw new Error("setup");

    const res = await deleteProjectImage({ id: added.data.id });
    expect(res.ok).toBe(true);
    expect(await rowsFor(projectId)).toHaveLength(0);
    // Blob isn't configured in the test env (no BLOB_READ_WRITE_TOKEN), so
    // del() must NOT be called — deletion is still best-effort-safe either
    // way, but this pins the "don't call an unconfigured SDK" behaviour.
    expect(delMock).not.toHaveBeenCalled();
  });

  test("calls blob del() with the pathname when Blob is configured", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    try {
      const projectId = await seedProject();
      const added = await recordProjectImage({
        projectId,
        url: "https://blob.example/doomed.webp",
        pathname: "project-images/doomed.webp",
      });
      if (!added.ok) throw new Error("setup");

      const res = await deleteProjectImage({ id: added.data.id });
      expect(res.ok).toBe(true);
      expect(delMock).toHaveBeenCalledWith(
        "project-images/doomed.webp",
        expect.objectContaining({ token: "test-token" }),
      );
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  test("cannot delete another user's image", async () => {
    const projectId = await seedProject();
    const added = await recordProjectImage({
      projectId,
      url: "https://blob.example/mine.webp",
      pathname: "project-images/mine.webp",
    });
    if (!added.ok) throw new Error("setup");

    state.userId = await seedExtraUser(state.db!, "intruder");
    const res = await deleteProjectImage({ id: added.data.id });
    expect(res.ok).toBe(false);
    expect(await rowsFor(projectId)).toHaveLength(1);
    expect(delMock).not.toHaveBeenCalled();
  });

  test("survives a blob del() failure — the row still deletes", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    delMock.mockRejectedValueOnce(new Error("network hiccup"));
    try {
      const projectId = await seedProject();
      const added = await recordProjectImage({
        projectId,
        url: "https://blob.example/flaky.webp",
        pathname: "project-images/flaky.webp",
      });
      if (!added.ok) throw new Error("setup");

      const res = await deleteProjectImage({ id: added.data.id });
      expect(res.ok).toBe(true);
      expect(await rowsFor(projectId)).toHaveLength(0);
    } finally {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });
});

describe("reorderProjectImages", () => {
  test("persists the new position order", async () => {
    const projectId = await seedProject();
    const a = await recordProjectImage({
      projectId,
      url: "https://blob.example/a.webp",
      pathname: "a.webp",
    });
    const b = await recordProjectImage({
      projectId,
      url: "https://blob.example/b.webp",
      pathname: "b.webp",
    });
    const c = await recordProjectImage({
      projectId,
      url: "https://blob.example/c.webp",
      pathname: "c.webp",
    });
    if (!a.ok || !b.ok || !c.ok) throw new Error("setup");

    const res = await reorderProjectImages({
      projectId,
      orderedIds: [c.data.id, a.data.id, b.data.id],
    });
    expect(res.ok).toBe(true);

    const rows = await rowsFor(projectId);
    expect(rows.map((r) => r.id)).toEqual([c.data.id, a.data.id, b.data.id]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  test("rejects an order that doesn't match the project's images", async () => {
    const projectId = await seedProject();
    const a = await recordProjectImage({
      projectId,
      url: "https://blob.example/a.webp",
      pathname: "a.webp",
    });
    if (!a.ok) throw new Error("setup");

    const res = await reorderProjectImages({
      projectId,
      orderedIds: [a.data.id, "not-a-real-id"],
    });
    expect(res.ok).toBe(false);
  });

  test("cannot reorder another user's project", async () => {
    const projectId = await seedProject();
    const a = await recordProjectImage({
      projectId,
      url: "https://blob.example/a.webp",
      pathname: "a.webp",
    });
    if (!a.ok) throw new Error("setup");

    state.userId = await seedExtraUser(state.db!, "intruder");
    const res = await reorderProjectImages({
      projectId,
      orderedIds: [a.data.id],
    });
    expect(res.ok).toBe(false);
  });
});

describe("loadProjectImages / listProjectImages", () => {
  test("reads rows back in position order, owner-scoped", async () => {
    const projectId = await seedProject();
    await recordProjectImage({
      projectId,
      url: "https://blob.example/one.webp",
      pathname: "one.webp",
    });
    await recordProjectImage({
      projectId,
      url: "https://blob.example/two.webp",
      pathname: "two.webp",
    });

    const viaAction = await loadProjectImages(projectId);
    expect(viaAction.map((r) => r.url)).toEqual([
      "https://blob.example/one.webp",
      "https://blob.example/two.webp",
    ]);

    const viaQuery = await listProjectImages(projectId);
    expect(viaQuery).toHaveLength(2);
  });

  test("loadProjectImages returns empty for a project the caller doesn't own", async () => {
    const projectId = await seedProject();
    await recordProjectImage({
      projectId,
      url: "https://blob.example/one.webp",
      pathname: "one.webp",
    });

    state.userId = await seedExtraUser(state.db!, "intruder");
    expect(await loadProjectImages(projectId)).toEqual([]);
  });
});
