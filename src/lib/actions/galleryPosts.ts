"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { listAllProjects, getProjectWithRecipe } from "@/db/queries/projects";
import { loadEditorRecipe } from "@/lib/appData";
import { saveRecipe, type SaveRecipeSlot } from "@/lib/actions/saveRecipe";
import {
  isNamedRecipe,
  UNNAMED_RECIPE_GALLERY_ERROR,
} from "@/lib/recipes/name";
import type { ActionResult } from "@/lib/actions/projects";
import type { RecipeSlot } from "@/lib/types";

/**
 * Composed gallery posts — the "share a model without already owning a
 * recipe" path.
 *
 * Every gallery post is still a recipe row: `/r/<slug>`, the clone target,
 * the OG card and the sitemap entry all hang off one, so a post composed
 * from scratch mints a recipe the same way a recipe-first post uses an
 * existing one. What changes is that the painter decides whether that row
 * joins their own library (`hiddenFromLibrary`, migration 0042).
 *
 * The composer prefills from a PROJECT rather than a recipe — the painter
 * thinks "I want to post my Ultramarines", not "I want to post recipe
 * #7" — so the reads here are project-shaped and resolve the attached
 * recipe on the way through.
 */

/** One row in the composer's "start from a project" dropdown. */
export interface GalleryComposerProject {
  id: string;
  title: string;
}

/** Everything the composer prefills when a project is picked. Photos are
 *  loaded separately by the composer's existing `loadProjectImages` effect —
 *  they are the one part that was already project-scoped. */
export interface GalleryPostPrefill {
  projectTitle: string;
  /** The project's attached recipes, newest first. Empty when the project
   *  has none — the composer then prefills the title only, which is the
   *  photo-only path. */
  recipes: ReadonlyArray<{
    id: string;
    name: string;
    slots: RecipeSlot[];
    notes: string | null;
  }>;
}

const idSchema = z.string().trim().min(1).max(64);

/** Every project the painter owns, for the composer's source dropdown.
 *  Deliberately id + title only: prefill is a second call made when one is
 *  actually picked, so opening the composer never pays for recipes or
 *  photos the painter may not want. */
export async function loadGalleryComposerProjects(): Promise<
  ReadonlyArray<GalleryComposerProject>
> {
  const userId = await currentUserId();
  if (!userId) return [];
  const rows = await listAllProjects(userId);
  return rows.map((p) => ({ id: p.id, title: p.name }));
}

/** Resolve a picked project into the composer's prefill payload. */
export async function loadGalleryPostPrefill(
  rawProjectId: string,
): Promise<ActionResult<GalleryPostPrefill>> {
  const parsed = idSchema.safeParse(rawProjectId);
  if (!parsed.success) return { ok: false, error: "Invalid project" };

  const userId = await currentUserId();
  const found = await getProjectWithRecipe(userId, parsed.data);
  if (!found) return { ok: false, error: "Project not found" };

  // `getProjectWithRecipe` returns the recipe ROWS; the composer needs the
  // hydrated editor shape (slots with resolved paint brand/name) to draw the
  // card preview, so hydrate each one the way /recipes does.
  const hydrated = await Promise.all(
    found.recipes.map(async (r) => {
      const detail = await loadEditorRecipe(userId, r.id);
      return {
        id: r.id,
        name: r.name,
        slots: detail?.slots ?? [],
        notes: detail?.notes ?? null,
      };
    }),
  );

  return {
    ok: true,
    data: { projectTitle: found.project.name, recipes: hydrated },
  };
}

const slotSchema = z.object({
  /** Null for a custom-colour slot — the card renders the hex either way. */
  paintId: z.string().trim().min(1).max(64).nullable(),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid colour"),
  layer: z.string().trim().max(64),
});

const createSchema = z.object({
  title: z.string().trim().min(1, "Give your post a title").max(120),
  /** Capped at the 12 the card itself renders (`slots.slice(0, 12)`), so a
   *  post can never carry paints its own card does not show. Zero is
   *  allowed — that is the photo-only post. */
  slots: z.array(slotSchema).max(12),
  notes: z.string().trim().max(2000).nullable(),
  saveToLibrary: z.boolean(),
});

/**
 * Mint the recipe row behind a composed gallery post. Returns the id the
 * composer then hands to `submitRecipeToGallery` — the submit path itself is
 * unchanged, so moderation, the blob binding and auto-publish all still
 * apply exactly as they do for a recipe-first post.
 */
export async function createGalleryPostRecipe(
  raw: z.input<typeof createSchema>,
): Promise<ActionResult<{ recipeId: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid post" };
  }
  const { title, slots, notes, saveToLibrary } = parsed.data;

  // R4-5's guard lives on the submit action too, but refusing here means a
  // placeholder-titled post never creates a row it would then fail to
  // publish.
  if (!isNamedRecipe(title)) {
    return { ok: false, error: UNNAMED_RECIPE_GALLERY_ERROR };
  }

  const toSave: SaveRecipeSlot[] = slots.map((s) => ({
    paintId: s.paintId,
    hex: s.hex,
    layer: s.layer || "basecoat",
  }));

  // Standalone, always — a composed post is not the source project's
  // recipe even when its content was prefilled from one. Attaching it would
  // silently give the project a second (or competing) colour scheme the
  // painter never asked for.
  const created = await saveRecipe({
    id: null,
    name: title,
    attachedProjectId: null,
    slots: toSave,
    notesMd: notes,
  });
  if (!created.ok) return created;

  if (!saveToLibrary) {
    const userId = await currentUserId();
    await db
      .update(recipes)
      .set({ hiddenFromLibrary: true })
      .where(
        and(eq(recipes.id, created.data.id), eq(recipes.ownerId, userId)),
      );
    revalidatePath("/recipes");
  }

  return { ok: true, data: { recipeId: created.data.id } };
}

const visibilitySchema = z.object({
  recipeId: idSchema,
  saveToLibrary: z.boolean(),
});

/**
 * Flip a post between "in my recipe list" and "gallery only" after the
 * fact — the reason the composer's checkbox is not a one-way door. Driven
 * from the gallery's "Your cards" strip.
 */
export async function setRecipeLibraryVisibility(
  raw: z.infer<typeof visibilitySchema>,
): Promise<ActionResult<{ saveToLibrary: boolean }>> {
  const parsed = visibilitySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { recipeId, saveToLibrary } = parsed.data;
  const userId = await currentUserId();

  const updated = await db
    .update(recipes)
    .set({ hiddenFromLibrary: !saveToLibrary })
    .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, userId)))
    .returning({ id: recipes.id });

  if (updated.length === 0) return { ok: false, error: "Recipe not found" };

  revalidatePath("/recipes");
  revalidatePath("/gallery");
  return { ok: true, data: { saveToLibrary } };
}
