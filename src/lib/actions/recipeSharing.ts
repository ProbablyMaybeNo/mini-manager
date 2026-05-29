"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes, type Recipe } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { generatePublicSlug } from "@/lib/recipes/slug";
import type { ActionResult } from "@/lib/actions/projects";

const recipeIdSchema = z.string().min(1).max(64);

const publishSchema = z.object({ recipeId: recipeIdSchema });
const unpublishSchema = z.object({ recipeId: recipeIdSchema });

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
