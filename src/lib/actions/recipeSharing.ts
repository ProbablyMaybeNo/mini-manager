"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes, recipeSlots, type Recipe } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { generatePublicSlug } from "@/lib/recipes/slug";
import { trackServer } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * Recipe SHARING (publish / clone) is free for every account — see the
 * "gallery/sharing" call in docs/SUBSCRIPTION_PAYWALL.md: sharing your own
 * work is the loop that recruits subscribers, so gating it would cost more
 * than it earns. This module intentionally does NOT check `isProUser`.
 */

const recipeIdSchema = z.string().min(1).max(64);
const slugSchema = z.string().min(1).max(64);

const publishSchema = z.object({ recipeId: recipeIdSchema });
const unpublishSchema = z.object({ recipeId: recipeIdSchema });
const cloneFromSlugSchema = z.object({ slug: slugSchema });

async function getOwnedRecipe(
  userId: string,
  recipeId: string,
): Promise<Recipe | null> {
  const rows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

function revalidateForSlug(slug: string) {
  revalidatePath(`/r/${slug}`);
}

function revalidateForRecipe(recipe: Recipe) {
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.id}`);
}

/**
 * Mint or reuse a public slug for a recipe. Idempotent — if the recipe
 * already has a slug, the existing value is returned. New slugs retry
 * up to 3 times on the (vanishingly rare) unique-index collision.
 */
export async function publishRecipe(
  raw: z.infer<typeof publishSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = publishSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const userId = await currentUserId();

  const existing = await getOwnedRecipe(userId, parsed.data.recipeId);
  if (!existing) return { ok: false, error: "Recipe not found" };

  if (existing.publicSlug) {
    return { ok: true, data: { slug: existing.publicSlug } };
  }

  // Up to 3 attempts in case of an alphabet collision. With ~8.2×10^14
  // possible slugs, hitting one is a near-impossibility, but we still
  // catch unique-index failures so a hostile race never bricks publish.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generatePublicSlug();
    try {
      const updated = await db
        .update(recipes)
        .set({ publicSlug: slug })
        .where(eq(recipes.id, existing.id))
        .returning();
      const row = updated[0];
      if (!row) return { ok: false, error: "Publish returned no row" };
      revalidateForRecipe(row);
      revalidateForSlug(slug);
      // Funnel: a recipe just went public — the distribution/moat loop.
      // Reaching here means it wasn't already published (that returns early).
      await trackServer(AnalyticsEvent.PublicRecipeShared);
      return { ok: true, data: { slug } };
    } catch (err) {
      lastError = err;
      // libsql surfaces a unique-constraint failure with `UNIQUE` in the
      // message; if the constraint was on something else, surface it.
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
        ? `Failed to mint a unique slug after 3 attempts: ${lastError.message}`
        : "Failed to mint a unique slug after 3 attempts",
  };
}

/**
 * Clear the public slug. After this, the public URL 404s within ~1s
 * (next revalidates the cached `/r/<slug>` path).
 */
export async function unpublishRecipe(
  raw: z.infer<typeof unpublishSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = unpublishSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const userId = await currentUserId();
  const existing = await getOwnedRecipe(userId, parsed.data.recipeId);
  if (!existing) return { ok: false, error: "Recipe not found" };

  if (!existing.publicSlug) {
    // Already unpublished — idempotent.
    return { ok: true, data: { id: existing.id } };
  }

  const previousSlug = existing.publicSlug;
  try {
    await db
      .update(recipes)
      .set({ publicSlug: null })
      .where(eq(recipes.id, existing.id));
    revalidateForRecipe(existing);
    revalidateForSlug(previousSlug);
    return { ok: true, data: { id: existing.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to unpublish recipe",
    };
  }
}

/**
 * Pick a unique name for the clone — appends " (cloned)" first, then
 * " (cloned 2)", " (cloned 3)", … until one is free for this owner.
 *
 * Done client-side via a single LIKE query rather than a tight loop of
 * point lookups; recipe-name collisions are O(handful) in practice.
 */
async function resolveCloneName(
  userId: string,
  baseName: string,
): Promise<string> {
  const firstChoice = `${baseName} (cloned)`;
  const prefix = `${baseName} (cloned`;
  // Match `name (cloned)` and `name (cloned N)` already owned by this user.
  const existing = await db
    .select({ name: recipes.name })
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), like(recipes.name, `${prefix}%`)));
  const taken = new Set(existing.map((r) => r.name));
  if (!taken.has(firstChoice)) return firstChoice;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${baseName} (cloned ${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  // Fallback — astronomically unlikely; suffix with a fresh slug to be safe.
  return `${baseName} (cloned ${generatePublicSlug()})`;
}

/**
 * Clone a published recipe into the current user's library. Deep-copies
 * the recipe, zones, and steps inside a single libsql transaction so a
 * partial clone never lands. The clone is standalone (no project / model
 * attachment carried) and its `publicSlug` is cleared — the new owner
 * publishes it independently if they want a public URL.
 *
 * Returns `{ ok: false, error: "This is already your recipe" }` when the
 * source already belongs to the current user — the caller (CloneButton)
 * surfaces this as a friendly message + a link to the existing recipe.
 */
export async function cloneRecipeFromSlug(
  raw: z.infer<typeof cloneFromSlugSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = cloneFromSlugSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const userId = await currentUserId();

  const sourceRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.publicSlug, parsed.data.slug))
    .limit(1);
  const source = sourceRows[0];
  if (!source) return { ok: false, error: "Recipe not found" };

  if (source.ownerId === userId) {
    return { ok: false, error: "This is already your recipe" };
  }

  const sourceSlots = await db
    .select()
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, source.id))
    .orderBy(asc(recipeSlots.position));

  const cloneName = await resolveCloneName(userId, source.name);

  // libsql's @libsql/client opens a fresh in-memory DB inside
  // `db.transaction()`, which breaks the per-test connection model used
  // throughout this project. So we run inserts sequentially and roll
  // back manually on any error — deleting the parent recipe cascades
  // to its slots via FK ON DELETE CASCADE.
  let newRecipeId: string | null = null;
  try {
    const insertedRecipe = await db
      .insert(recipes)
      .values({
        ownerId: userId,
        name: cloneName,
        bodyType: source.bodyType,
        attachedProjectId: null,
        isStandalone: true,
        publicSlug: null,
        notesMd: source.notesMd ?? null,
      })
      .returning({ id: recipes.id });
    newRecipeId = insertedRecipe[0]?.id ?? null;
    if (!newRecipeId) throw new Error("Clone insert returned no row");

    for (const slot of sourceSlots) {
      await db.insert(recipeSlots).values({
        recipeId: newRecipeId,
        position: slot.position,
        technique: slot.technique,
        paintId: slot.paintId,
        customColorHex: slot.customColorHex,
        notesMd: slot.notesMd,
        notes: slot.notes,
      });
    }

    // Best-effort popularity signal — bump the SOURCE recipe's clone count
    // (the recipe the slug points to, not the fresh copy). Never fail the
    // clone if this errors; the clone itself already succeeded.
    try {
      await db
        .update(recipes)
        .set({ cloneCount: sql`${recipes.cloneCount} + 1` })
        .where(eq(recipes.id, source.id));
    } catch {
      /* best-effort — the clone stands regardless */
    }

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${newRecipeId}`);
    await trackServer(AnalyticsEvent.RecipeCloned, { sourceRecipeId: source.id });
    return { ok: true, data: { id: newRecipeId } };
  } catch (err) {
    // Roll back any partial state — deleting the recipe cascades slots.
    // Swallow secondary failures during cleanup so the original error
    // surfaces.
    if (newRecipeId) {
      try {
        await db.delete(recipes).where(eq(recipes.id, newRecipeId));
      } catch {
        /* best-effort cleanup */
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to clone recipe",
    };
  }
}
