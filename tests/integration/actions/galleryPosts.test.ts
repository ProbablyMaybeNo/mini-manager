/**
 * Composed gallery posts — the "share a model without already owning a
 * recipe" path. Runs against a real in-memory libsql DB with all migrations
 * applied.
 *
 * The load-bearing behaviours here are the ones a UI test can't pin down:
 * that a composed post really is a standalone recipe row, that the painter's
 * "save this to my recipe list" answer lands on it, that unticking actually
 * removes it from the query every self-facing surface reads, and that the
 * choice is reversible.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { projects, recipes, recipeSlots } from "@/db/schema";

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

const { createGalleryPostRecipe, setRecipeLibraryVisibility } = await import(
  "@/lib/actions/galleryPosts"
);
const { loadDashboardRecipeBundle } = await import("@/db/queries/recipes");

const PAINT_SLOTS = [
  { paintId: "citadel-macragge-blue", hex: "#0D407F", layer: "basecoat" },
  { paintId: "citadel-calgar-blue", hex: "#4C71B5", layer: "highlight" },
];

async function rowFor(recipeId: string) {
  const [row] = await state
    .db!.select()
    .from(recipes)
    .where(eq(recipes.id, recipeId));
  return row;
}

async function slotsFor(recipeId: string) {
  return state.db!.select().from(recipeSlots).where(eq(recipeSlots.recipeId, recipeId));
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

describe("createGalleryPostRecipe", () => {
  test("mints a standalone recipe carrying the title, paints and technique", async () => {
    const res = await createGalleryPostRecipe({
      title: "Ultramarines — Battle Company",
      slots: PAINT_SLOTS,
      notes: "Two thin coats, edge highlight last.",
      saveToLibrary: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await rowFor(res.data.recipeId);
    expect(row?.name).toBe("Ultramarines — Battle Company");
    expect(row?.notesMd).toBe("Two thin coats, edge highlight last.");
    expect(row?.isStandalone).toBe(true);
    // Standalone even though the composer prefills FROM a project: the post
    // is not that project's colour scheme.
    expect(row?.attachedProjectId).toBeNull();

    const slots = await slotsFor(res.data.recipeId);
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.paintId).sort()).toEqual(
      ["citadel-calgar-blue", "citadel-macragge-blue"],
    );
  });

  test("saveToLibrary true keeps the post in the painter's library", async () => {
    const res = await createGalleryPostRecipe({
      title: "Kept Post",
      slots: PAINT_SLOTS,
      notes: null,
      saveToLibrary: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await rowFor(res.data.recipeId))?.hiddenFromLibrary).toBe(false);
  });

  test("saveToLibrary false hides it from the library but still creates it", async () => {
    const res = await createGalleryPostRecipe({
      title: "Gallery Only Post",
      slots: PAINT_SLOTS,
      notes: null,
      saveToLibrary: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await rowFor(res.data.recipeId);
    // The row must exist regardless — the gallery post hangs off it.
    expect(row?.name).toBe("Gallery Only Post");
    expect(row?.hiddenFromLibrary).toBe(true);
  });

  test("a photo-only post — zero paints — is allowed", async () => {
    const res = await createGalleryPostRecipe({
      title: "Just The Mini",
      slots: [],
      notes: null,
      saveToLibrary: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(await slotsFor(res.data.recipeId)).toHaveLength(0);
  });

  test("refuses an unnamed post and creates nothing", async () => {
    const before = await state.db!.select().from(recipes);
    const res = await createGalleryPostRecipe({
      title: "Untitled recipe",
      slots: PAINT_SLOTS,
      notes: null,
      saveToLibrary: true,
    });
    expect(res.ok).toBe(false);
    // R4-5 — the placeholder name is the card's headline under our own
    // wordmark, so it must not reach the gallery, and must not leave a row
    // behind on the way to being refused.
    expect(await state.db!.select().from(recipes)).toHaveLength(before.length);
  });

  test("refuses a blank title", async () => {
    const res = await createGalleryPostRecipe({
      title: "   ",
      slots: [],
      notes: null,
      saveToLibrary: true,
    });
    expect(res.ok).toBe(false);
  });

  test("caps the paints at the 12 the card itself renders", async () => {
    const res = await createGalleryPostRecipe({
      title: "Too Many Paints",
      slots: Array.from({ length: 13 }, (_, i) => ({
        paintId: `p-${i}`,
        hex: "#112233",
        layer: "basecoat",
      })),
      notes: null,
      saveToLibrary: true,
    });
    expect(res.ok).toBe(false);
  });
});

describe("library visibility", () => {
  test("a hidden post is absent from the bundle every self-facing surface reads", async () => {
    const kept = await createGalleryPostRecipe({
      title: "Kept Post",
      slots: PAINT_SLOTS,
      notes: null,
      saveToLibrary: true,
    });
    const hidden = await createGalleryPostRecipe({
      title: "Gallery Only Post",
      slots: PAINT_SLOTS,
      notes: null,
      saveToLibrary: false,
    });
    expect(kept.ok && hidden.ok).toBe(true);
    if (!kept.ok || !hidden.ok) return;

    const bundle = await loadDashboardRecipeBundle(state.userId);
    const ids = bundle.recipeRows.map((r) => r.id);
    expect(ids).toContain(kept.data.recipeId);
    expect(ids).not.toContain(hidden.data.recipeId);
  });

  test("setRecipeLibraryVisibility takes a gallery-only post back", async () => {
    const res = await createGalleryPostRecipe({
      title: "Gallery Only Post",
      slots: PAINT_SLOTS,
      notes: null,
      saveToLibrary: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const flipped = await setRecipeLibraryVisibility({
      recipeId: res.data.recipeId,
      saveToLibrary: true,
    });
    expect(flipped.ok).toBe(true);
    expect((await rowFor(res.data.recipeId))?.hiddenFromLibrary).toBe(false);

    const bundle = await loadDashboardRecipeBundle(state.userId);
    expect(bundle.recipeRows.map((r) => r.id)).toContain(res.data.recipeId);
  });

  test("cannot flip a recipe owned by someone else", async () => {
    const otherUserId = await seedExtraUser(state.db!);
    const otherRecipeId = nanoid(16);
    await state.db!.insert(recipes).values({
      id: otherRecipeId,
      ownerId: otherUserId,
      name: "Not Yours",
      bodyType: "infantry",
      isStandalone: true,
      hiddenFromLibrary: true,
    });

    const res = await setRecipeLibraryVisibility({
      recipeId: otherRecipeId,
      saveToLibrary: true,
    });
    expect(res.ok).toBe(false);
    expect((await rowFor(otherRecipeId))?.hiddenFromLibrary).toBe(true);
  });

  test("a hidden recipe attached to a project stays out of the bundle", async () => {
    // Belt-and-braces on the filter: it is a WHERE on the owner-scoped read,
    // not something the standalone/attached split could route around.
    const projectId = nanoid(16);
    await state.db!.insert(projects).values({
      id: projectId,
      ownerId: state.userId,
      name: "Ultramarines",
      type: "Unit",
    });
    const recipeId = nanoid(16);
    await state.db!.insert(recipes).values({
      id: recipeId,
      ownerId: state.userId,
      name: "Attached But Hidden",
      bodyType: "infantry",
      attachedProjectId: projectId,
      isStandalone: false,
      hiddenFromLibrary: true,
    });

    const bundle = await loadDashboardRecipeBundle(state.userId);
    expect(bundle.recipeRows.map((r) => r.id)).not.toContain(recipeId);
  });
});
