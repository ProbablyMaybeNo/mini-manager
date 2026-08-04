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
  /** How many times the (paid, in production) vision call was reached. */
  calls: 0,
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
  moderateGalleryImage: async () => {
    moderation.calls += 1;
    return { verdict: moderation.verdict, reason: moderation.reason };
  },
}));

const { submitRecipeToGallery, approveGallerySubmission, rejectGallerySubmission } =
  await import("@/lib/actions/gallerySubmissions");
const { listPublishedRecipes } = await import("@/db/queries/recipes");

const ADMIN_EMAIL = "admin-review@example.com";

// Submissions must point at our own Vercel Blob store; build url+pathname
// from one source so they always agree (the submit path rejects a mismatch).
const BLOB_HOST = "https://teststore.public.blob.vercel-storage.com";
const blobUrl = (pathname: string) => `${BLOB_HOST}/${pathname}`;

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
    // E3: admin requires a VERIFIED email — an unverified account, even on
    // the allowlist, is no longer authorized.
    emailVerified: new Date(),
  });
  return id;
}

async function submitFixture(recipeId: string, pathname = "gallery-cards/x/1.png") {
  return submitRecipeToGallery({
    recipeId,
    imageUrl: blobUrl(pathname),
    imagePathname: pathname,
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
  moderation.calls = 0;
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
    expect(row?.galleryImageUrl).toBe(blobUrl("gallery-cards/x/1.png"));
    expect(row?.galleryImagePathname).toBe("gallery-cards/x/1.png");
    expect(row?.galleryImageRatio).toBe("1:1");
    expect(row?.gallerySubmittedAt).not.toBeNull();
    // Not visible on /gallery until an admin approves it.
    expect(row?.isListed).toBe(false);
  });

  test("rejects an off-host imageUrl (moderation-bypass / SSRF lock)", async () => {
    moderation.verdict = "pass";
    const recipeId = await seedRecipe({ name: "Off Host" });
    const res = await submitRecipeToGallery({
      recipeId,
      imageUrl: "https://evil.example/gallery-cards/x/1.png",
      imagePathname: "gallery-cards/x/1.png",
      ratio: "1:1",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/uploaded gallery card/i);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("none");
    expect(row?.galleryImageUrl).toBeNull();
  });

  test("rejects when the blob URL pathname does not match imagePathname", async () => {
    const recipeId = await seedRecipe({ name: "Mismatch" });
    const res = await submitRecipeToGallery({
      recipeId,
      imageUrl: blobUrl("gallery-cards/x/1.png"),
      imagePathname: "gallery-cards/x/other.png",
      ratio: "1:1",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/does not match/i);
  });

  /**
   * R4-5 — an unnamed recipe cannot reach the public gallery. The composer
   * says so before the click, but SUBMIT is a server action a client can call
   * directly, so this is the guard that actually holds.
   */
  test("refuses a recipe still carrying the auto-name, and drops the uploaded card", async () => {
    moderation.verdict = "pass";
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const recipeId = await seedRecipe({ name: "Untitled recipe" });

    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    // Not a bare refusal — the message names the fix.
    expect(res.error).toMatch(/name/i);
    expect(res.error).toMatch(/gallery/i);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("none");
    expect(row?.galleryImageUrl).toBeNull();
    expect(row?.isListed).toBe(false);

    // Refused BEFORE the paid vision call, and the just-uploaded blob is
    // dropped rather than orphaned — same handling as a moderation `fail`.
    expect(moderation.calls).toBe(0);
    expect(delMock).toHaveBeenCalledWith("gallery-cards/x/1.png", expect.anything());
  });

  test("refuses a blank-named recipe too", async () => {
    moderation.verdict = "pass";
    const recipeId = await seedRecipe({ name: "   " });
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(false);
    expect(moderation.calls).toBe(0);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.isListed).toBe(false);
  });

  test("the same recipe publishes once it has a real name", async () => {
    moderation.verdict = "pass";
    const recipeId = await seedRecipe({ name: "Untitled recipe" });
    expect((await submitFixture(recipeId)).ok).toBe(false);

    await state.db!
      .update(recipes)
      .set({ name: "Dark Prussian Blue scheme" })
      .where(eq(recipes.id, recipeId));

    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe("approved");

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.isListed).toBe(true);
  });

  test("accepts an on-host blob URL whose pathname matches", async () => {
    moderation.verdict = "pass";
    const recipeId = await seedRecipe({ name: "On Host Ok" });
    const res = await submitFixture(recipeId);
    expect(res.ok).toBe(true);
    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryImageUrl).toBe(blobUrl("gallery-cards/x/1.png"));
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
    await submitFixture(recipeId, "gallery-cards/x/1.png");

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
      imageUrl: blobUrl("gallery-cards/x/2.png"),
      imagePathname: "gallery-cards/x/2.png",
      ratio: "1:1",
    });

    gallery = await listPublishedRecipes();
    expect(gallery.some((g) => g.name === "Round Two")).toBe(false);

    const [row] = await state.db!.select().from(recipes).where(eq(recipes.id, recipeId));
    expect(row?.galleryStatus).toBe("pending");
    expect(row?.galleryImageUrl).toBe(blobUrl("gallery-cards/x/2.png"));
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
    expect(card?.cardImageUrl).toBe(blobUrl("gallery-cards/x/1.png"));
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

describe("gallery submit daily quota (E7)", () => {
  afterEach(() => {
    delete process.env.MM_GALLERY_DAILY_LIMIT;
  });

  test("refuses the N+1th submission from one user in a day", async () => {
    process.env.MM_GALLERY_DAILY_LIMIT = "2";
    const recipeId = await seedRecipe();

    const first = await submitFixture(recipeId);
    const second = await submitFixture(recipeId);
    const third = await submitFixture(recipeId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    if (third.ok) return;
    expect(third.error).toMatch(/gallery submission limit/i);
  });
});
