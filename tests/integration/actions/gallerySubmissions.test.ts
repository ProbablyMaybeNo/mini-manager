/**
 * Recipe-card phase 3 — gallery submit-for-review + admin approve/reject.
 * Runs against a real in-memory libsql DB with all migrations applied;
 * Vercel Blob's `del()` is mocked (used by reject's best-effort cleanup) —
 * this suite never hits the network or requires a real
 * BLOB_READ_WRITE_TOKEN.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { makeTestDb, seedExtraUser, type TestDb } from "../_helpers/testDb";
import { recipes, users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as TestDb | null,
  userId: "" as string,
}));

const delMock = vi.hoisted(() => vi.fn(async () => undefined));

// Controllable moderation verdict — defaults to `flag` (→ human review queue)
// so the existing submit/approve/reject flow tests all see a `pending`
// submission; individual tests override `moderation.verdict` to exercise the
// auto-publish (`pass`) and block (`fail`) branches.
const moderation = vi.hoisted(() => ({
  verdict: "flag" as "pass" | "flag" | "fail" | "error",
  reason: null as string | null,
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
vi.mock("@vercel/blob", () => ({ del: delMock }));
vi.mock("@/lib/ai/imageModeration", () => ({
  moderateGalleryImage: async () => ({ verdict: moderation.verdict, reason: moderation.reason }),
}));

const { submitRecipeToGallery, approveGallerySubmission, rejectGallerySubmission } =
  await import("@/lib/actions/gallerySubmissions");
const { listPublishedRecipes } = await import("@/db/queries/recipes");

const ADMIN_EMAIL = "admin-review@example.com";

async function seedRecipe(overrides: Partial<typeof recipes.$inferInsert> = {}) {
  const id = nanoid(16);
  await state.db!.insert(recipes).values({
    id,
    ownerId: state.userId,
    name: "Test Recipe",
    bodyType: "infantry",
    isStandalone: true,
    ...overrides,
  });
  return id;
}

async function seedAdmin(): Promise<string> {
  const id = nanoid(16);
  await state.db!.insert(users).values({
    id,
    email: ADMIN_EMAIL,
    name: "Admin",
    plan: "pro_lifetime",
  });
  return id;
}

async function submitFixture(recipeId: string, imageUrl = "https://blob.example/card.png") {
  return submitRecipeToGallery({
    recipeId,
    imageUrl,
    imagePathname: "gallery-cards/x/1.png",
    ratio: "1:1",
  });
}

beforeEach(async () => {
  const { db, userId } = await makeTestDb();
  state.db = db;
  state.userId = userId;
  delMock.mockClear();
  moderation.verdict = "flag";
  moderation.reason = null;
  process.env.MM_ADMIN_EMAILS = ADMIN_EMAIL;
});

afterEach(() => {
  state.db = null;
  state.userId = "";
  delete process.env.MM_ADMIN_EMAILS;
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("submitRecipeToGallery", () => {
  test("creates a pending submission with the uploaded card's url/pathname/ratio", async () => {
    const recipeId = await seedRecipe();
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(true);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("pending");
    expect(row?.galleryImageUrl).toBe("https://blob.example/card.png");
    expect(row?.galleryImagePathname).toBe("gallery-cards/x/1.png");
    expect(row?.galleryImageRatio).toBe("1:1");
    expect(row?.gallerySubmittedAt).not.toBeNull();
    // Not visible on /gallery until an admin approves it.
    expect(row?.isListed).toBe(false);
  });

  test("does not appear on the public gallery while pending", async () => {
    const recipeId = await seedRecipe({ name: "Pending Not Yet Public" });
    await submitFixture(recipeId);
    const gallery = await listPublishedRecipes();
    expect(gallery.some((g) => g.name === "Pending Not Yet Public")).toBe(false);
  });

  test("rejects a recipe owned by another user", async () => {
    const recipeId = await seedRecipe();
    state.userId = await seedExtraUser(state.db!, "intruder");
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
  });

  test("auto-publishes a clean (pass) submission straight to the live gallery", async () => {
    moderation.verdict = "pass";
    const recipeId = await seedRecipe({ name: "Clean Auto Publish" });
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe("approved");

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("approved");
    expect(row?.isListed).toBe(true);
    expect(row?.publicSlug).not.toBeNull();
    expect(row?.galleryReviewedAt).not.toBeNull();
    expect(row?.galleryModeration).toBe("pass");

    const gallery = await listPublishedRecipes();
    expect(gallery.some((g) => g.name === "Clean Auto Publish")).toBe(true);
  });

  test("blocks a submission the moderator fails and deletes the uploaded blob", async () => {
    moderation.verdict = "fail";
    moderation.reason = "photographic explicit content";
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const recipeId = await seedRecipe({ name: "Blocked" });
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/inappropriate/i);
    expect(delMock).toHaveBeenCalledWith("gallery-cards/x/1.png", expect.anything());

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("none");
    expect(row?.isListed).toBe(false);
  });

  test("routes a moderation error to the review queue (fail-open, not blocked)", async () => {
    moderation.verdict = "error";
    const recipeId = await seedRecipe({ name: "Fail Open" });
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(true);
    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("pending");
    expect(row?.isListed).toBe(false);
  });

  test("resubmitting an approved recipe pulls it off the gallery until re-approved", async () => {
    const ownerId = state.userId;
    const recipeId = await seedRecipe({ name: "Round Two" });
    await submitFixture(recipeId, "https://blob.example/v1.png");

    const adminId = await seedAdmin();
    state.userId = adminId;
    const approved = await approveGallerySubmission({ recipeId });
    expect(approved.ok).toBe(true);

    let gallery = await listPublishedRecipes();
    expect(gallery.some((g) => g.name === "Round Two")).toBe(true);

    // Owner resubmits a fresh render — the recipe must drop off the public
    // gallery again until re-reviewed, so an unapproved image never leaks.
    state.userId = ownerId;
    await submitRecipeToGallery({
      recipeId,
      imageUrl: "https://blob.example/v2.png",
      imagePathname: "gallery-cards/x/2.png",
      ratio: "1:1",
    });

    gallery = await listPublishedRecipes();
    expect(gallery.some((g) => g.name === "Round Two")).toBe(false);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("pending");
    expect(row?.galleryImageUrl).toBe("https://blob.example/v2.png");
  });
});

describe("approveGallerySubmission", () => {
  test("mints a public slug, lists the recipe, and it renders as a card on /gallery", async () => {
    const recipeId = await seedRecipe({ name: "Approved Salamanders" });
    await submitFixture(recipeId);

    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await approveGallerySubmission({ recipeId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.slug).toHaveLength(10);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("approved");
    expect(row?.isListed).toBe(true);
    expect(row?.publicSlug).toBe(res.data.slug);
    expect(row?.galleryReviewedAt).not.toBeNull();

    const gallery = await listPublishedRecipes();
    const card = gallery.find((g) => g.slug === res.data.slug);
    expect(card?.name).toBe("Approved Salamanders");
    expect(card?.cardImageUrl).toBe("https://blob.example/card.png");
  });

  test("keeps an existing public slug rather than minting a new one", async () => {
    const recipeId = await seedRecipe({ publicSlug: "existing12" });
    await submitFixture(recipeId);
    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await approveGallerySubmission({ recipeId });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.slug).toBe("existing12");
  });

  test("rejects a submission that isn't pending", async () => {
    const recipeId = await seedRecipe();
    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await approveGallerySubmission({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/pending/i);
  });

  test("non-admin cannot approve", async () => {
    const recipeId = await seedRecipe();
    await submitFixture(recipeId);
    // state.userId is still the original (non-admin) owner.
    const res = await approveGallerySubmission({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not authorized/i);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("pending");
    expect(row?.isListed).toBe(false);
  });
});

describe("rejectGallerySubmission", () => {
  test("clears the card image, marks rejected, calls blob del(), and stays off the gallery", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const recipeId = await seedRecipe({ name: "Declined Recipe" });
    await submitFixture(recipeId);

    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await rejectGallerySubmission({ recipeId });
    expect(res.ok).toBe(true);
    expect(delMock).toHaveBeenCalledWith(
      "gallery-cards/x/1.png",
      expect.objectContaining({ token: "test-token" }),
    );

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("rejected");
    expect(row?.galleryImageUrl).toBeNull();
    expect(row?.galleryImagePathname).toBeNull();
    expect(row?.isListed).toBe(false);

    const gallery = await listPublishedRecipes();
    expect(gallery.some((g) => g.name === "Declined Recipe")).toBe(false);
  });

  test("non-admin cannot reject", async () => {
    const recipeId = await seedRecipe();
    await submitFixture(recipeId);
    const res = await rejectGallerySubmission({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not authorized/i);
    expect(delMock).not.toHaveBeenCalled();
  });

  test("rejects a submission that isn't pending", async () => {
    const recipeId = await seedRecipe();
    const adminId = await seedAdmin();
    state.userId = adminId;
    const res = await rejectGallerySubmission({ recipeId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/pending/i);
  });
});
