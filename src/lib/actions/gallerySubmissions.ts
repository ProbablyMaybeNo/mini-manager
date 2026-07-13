"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes, users, type Recipe } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { isAdminEmail } from "@/lib/admin/allowlist";
import { blobReadWriteToken, isBlobConfigured } from "@/lib/blob/env";
import { generatePublicSlug } from "@/lib/recipes/slug";
import { moderateGalleryImage } from "@/lib/ai/imageModeration";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Recipe-card phase 3 — gallery submit-for-review + admin approve/reject.
 *
 * IMPORTANT: this file must NOT import `@/auth` — see recipeSharing.ts /
 * projectImages.ts for why (it breaks the integration suite's top-level
 * import). Ownership + the admin check both resolve through
 * `currentUserId()` + a plain `users` row read.
 *
 * Data model: NOT a separate `gallerySubmission` table. A "submission" is
 * just the recipe row carrying its own moderation state
 * (`galleryStatus` / `galleryImageUrl` / `galleryImagePathname` /
 * `galleryImageRatio` / `gallerySubmittedAt` / `galleryReviewedAt`,
 * added in migration 0032). Reasons:
 *   - The gallery is already driven by `recipes.isListed` +
 *     `recipes.publicSlug` (see `listPublishedRecipes`) — a submissions
 *     table would need its own listing query duplicating that logic.
 *   - A recipe only ever needs ONE live gallery card at a time; there's
 *     no product need to keep a history of past submissions.
 *   - The card PNG itself already IS the "snapshot" of the recipe's
 *     name/swatches/notes at submission time — no separate snapshot
 *     columns needed.
 * The tradeoff: no submission history / audit trail beyond the single
 * `gallerySubmittedAt` / `galleryReviewedAt` timestamps. Fine for v1.
 */

const idSchema = z.string().min(1).max(64);
const ratioSchema = z.enum(["1:1", "9:16"]);

async function getOwnedRecipe(userId: string, recipeId: string): Promise<Recipe | null> {
  const rows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  const rows = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  return rows[0] ?? null;
}

/** Best-effort blob delete — never throws, mirrors deleteProjectImage. */
async function deleteBlobBestEffort(pathname: string | null): Promise<void> {
  if (!pathname || !isBlobConfigured()) return;
  try {
    await del(pathname, { token: blobReadWriteToken() ?? undefined });
  } catch {
    /* swallow — an orphaned blob object is cheap and recoverable */
  }
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const userId = await currentUserId();
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const email = rows[0]?.email;
  if (!isAdminEmail(email)) {
    return { ok: false, error: "Not authorized" };
  }
  return { ok: true, userId };
}

function revalidateGallery(slug?: string | null) {
  revalidatePath("/gallery");
  revalidatePath("/admin/gallery");
  if (slug) revalidatePath(`/r/${slug}`);
}

/* ============================================================
   submitRecipeToGallery — the review-gated SUBMIT button.
   ============================================================ */

const submitSchema = z.object({
  recipeId: idSchema,
  imageUrl: z.string().trim().url("Invalid image URL").max(2048),
  imagePathname: z.string().trim().min(1).max(1024),
  ratio: ratioSchema,
});

export async function submitRecipeToGallery(
  raw: z.infer<typeof submitSchema>,
): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { recipeId, imageUrl, imagePathname, ratio } = parsed.data;
  const userId = await currentUserId();

  const existing = await getOwnedRecipe(userId, recipeId);
  if (!existing) return { ok: false, error: "Recipe not found" };

  // Automated image moderation (Claude Haiku vision) — defence-in-depth ahead
  // of the human review queue. Only a clear `fail` (real-world explicit
  // content) blocks the submit; `pass` / `flag` / `error` all still proceed to
  // `pending` for admin review, with the verdict recorded to direct attention.
  // Miniature gore/nudity on a sculpt is expected to PASS (see the prompt).
  const moderation = await moderateGalleryImage(imageUrl);
  if (moderation.verdict === "fail") {
    // Drop the just-uploaded blob — a blocked image shouldn't linger.
    await deleteBlobBestEffort(imagePathname);
    return {
      ok: false,
      error:
        "This image can't be posted to the public gallery — it was flagged as inappropriate. " +
        "If you think that's a mistake, email support and we'll take a look.",
    };
  }

  // Best-effort cleanup of a prior card image — a re-submit (e.g. after a
  // rejection) shouldn't leave the old blob object orphaned.
  if (existing.galleryImagePathname && existing.galleryImagePathname !== imagePathname) {
    await deleteBlobBestEffort(existing.galleryImagePathname);
  }

  try {
    await db
      .update(recipes)
      .set({
        galleryImageUrl: imageUrl,
        galleryImagePathname: imagePathname,
        galleryImageRatio: ratio,
        galleryStatus: "pending",
        gallerySubmittedAt: new Date(),
        galleryReviewedAt: null,
        galleryModeration: moderation.verdict,
        galleryModerationReason: moderation.reason,
        galleryModeratedAt: new Date(),
        // Pull the card off public view while it's under (re-)review —
        // only `approveGallerySubmission` may flip this back to true, so a
        // resubmit of a previously-approved recipe can't leak an
        // unreviewed image onto /gallery.
        isListed: false,
      })
      .where(eq(recipes.id, recipeId));
    revalidateGallery(existing.publicSlug);
    return { ok: true, data: { recipeId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to submit to the gallery",
    };
  }
}

/* ============================================================
   approveGallerySubmission — admin-only.
   ============================================================ */

const reviewSchema = z.object({ recipeId: idSchema });

/**
 * Mint a public slug for a recipe that doesn't have one yet — same retry
 * loop as `publishRecipe` in recipeSharing.ts, but NOT Pro-gated: a recipe
 * must be publicly viewable at `/r/<slug>` to appear on `/gallery` at all,
 * and gallery submission/review is explicitly a free feature (see the
 * phase-3 brief), so approval mints the slug directly rather than routing
 * through the gated `publishRecipe` action.
 */
async function ensurePublicSlug(recipe: Recipe): Promise<
  { ok: true; slug: string } | { ok: false; error: string }
> {
  if (recipe.publicSlug) return { ok: true, slug: recipe.publicSlug };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generatePublicSlug();
    try {
      await db.update(recipes).set({ publicSlug: slug }).where(eq(recipes.id, recipe.id));
      return { ok: true, slug };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toUpperCase().includes("UNIQUE")) {
        return { ok: false, error: msg };
      }
    }
  }
  return {
    ok: false,
    error:
      lastError instanceof Error
        ? `Failed to mint a unique slug: ${lastError.message}`
        : "Failed to mint a unique slug",
  };
}

export async function approveGallerySubmission(
  raw: z.infer<typeof reviewSchema>,
): Promise<ActionResult<{ recipeId: string; slug: string }>> {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const recipe = await getRecipeById(parsed.data.recipeId);
  if (!recipe) return { ok: false, error: "Recipe not found" };
  if (recipe.galleryStatus !== "pending") {
    return { ok: false, error: "This submission isn't pending review" };
  }

  const slugRes = await ensurePublicSlug(recipe);
  if (!slugRes.ok) return slugRes;

  try {
    await db
      .update(recipes)
      .set({
        galleryStatus: "approved",
        isListed: true,
        galleryReviewedAt: new Date(),
      })
      .where(eq(recipes.id, recipe.id));
    revalidateGallery(slugRes.slug);
    return { ok: true, data: { recipeId: recipe.id, slug: slugRes.slug } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to approve submission",
    };
  }
}

/* ============================================================
   rejectGallerySubmission — admin-only.
   ============================================================ */

export async function rejectGallerySubmission(
  raw: z.infer<typeof reviewSchema>,
): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const recipe = await getRecipeById(parsed.data.recipeId);
  if (!recipe) return { ok: false, error: "Recipe not found" };
  if (recipe.galleryStatus !== "pending") {
    return { ok: false, error: "This submission isn't pending review" };
  }

  await deleteBlobBestEffort(recipe.galleryImagePathname);

  try {
    await db
      .update(recipes)
      .set({
        galleryStatus: "rejected",
        isListed: false,
        galleryImageUrl: null,
        galleryImagePathname: null,
        galleryImageRatio: null,
        galleryReviewedAt: new Date(),
      })
      .where(eq(recipes.id, recipe.id));
    revalidateGallery(recipe.publicSlug);
    return { ok: true, data: { recipeId: recipe.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reject submission",
    };
  }
}
