/**
 * R4-9 probe — the REFERENCE section's own Save (now "Save link") persists the
 * reference URL, and `loadProjectDetail` reads it back. Written because the
 * R4-9 browser check round-tripped that field and wanted the server half of it
 * pinned somewhere cheaper than an E2E.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
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

const { setProjectReferenceImage, loadProjectDetail } = await import(
  "@/lib/actions/projectMeta"
);

async function seedProject(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(projects).values({
    id,
    ownerId: state.userId,
    name: "Reference Test",
    type: "Army",
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

describe("setProjectReferenceImage", () => {
  test("persists the URL and reads it back through loadProjectDetail", async () => {
    const id = await seedProject();
    const res = await setProjectReferenceImage({
      id,
      url: "https://example.com/reference.jpg",
    });
    expect(res.ok).toBe(true);

    const [row] = await state.db!.select().from(projects).where(eq(projects.id, id));
    expect(row?.referenceImageUrl).toBe("https://example.com/reference.jpg");

    const detail = await loadProjectDetail(id);
    expect(detail?.referenceImageUrl).toBe("https://example.com/reference.jpg");
  });

  test("clearing the field stores null rather than an empty string", async () => {
    const id = await seedProject();
    await setProjectReferenceImage({ id, url: "https://example.com/a.jpg" });
    const res = await setProjectReferenceImage({ id, url: null });
    expect(res.ok).toBe(true);
    expect((await loadProjectDetail(id))?.referenceImageUrl).toBeNull();
  });

  test("rejects a non-URL without touching what is stored", async () => {
    const id = await seedProject();
    await setProjectReferenceImage({ id, url: "https://example.com/a.jpg" });
    const res = await setProjectReferenceImage({ id, url: "not a url" });
    expect(res.ok).toBe(false);
    expect((await loadProjectDetail(id))?.referenceImageUrl).toBe(
      "https://example.com/a.jpg",
    );
  });
});
