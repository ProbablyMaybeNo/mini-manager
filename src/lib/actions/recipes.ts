"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  bodyTypes,
  namedModels,
  projects,
  recipes,
  type Recipe,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

const recipeIdSchema = z.string().min(1).max(64);

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  bodyType: z.enum(bodyTypes).default("infantry"),
  attachedProjectId: z.string().min(1).max(64).nullish(),
  attachedNamedModelId: z.string().min(1).max(64).nullish(),
  notesMd: z.string().max(20_000).nullish(),
});

// Use z.input so fields with .default() (bodyType) are optional in
// callers — they only become required after Zod applies the default.
export type CreateRecipeInput = z.input<typeof createSchema>;

const updateSchema = z.object({
  id: recipeIdSchema,
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long")
    .optional(),
  bodyType: z.enum(bodyTypes).optional(),
  notesMd: z.string().max(20_000).nullish(),
});

const attachToProjectSchema = z.object({
  recipeId: recipeIdSchema,
  projectId: z.string().min(1).max(64),
});

const attachToNamedModelSchema = z.object({
  recipeId: recipeIdSchema,
  namedModelId: z.string().min(1).max(64),
});

const detachSchema = z.object({
  recipeId: recipeIdSchema,
});

const deleteSchema = z.object({
  id: recipeIdSchema,
});

/* ============================================================
   Helpers
   ============================================================ */

async function verifyProjectOwnership(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return rows.length === 1;
}

async function verifyNamedModelOwnership(
  userId: string,
  namedModelId: string,
): Promise<{ projectId: string } | null> {
  const rows = await db
    .select({ projectId: namedModels.projectId })
    .from(namedModels)
    .innerJoin(projects, eq(projects.id, namedModels.projectId))
    .where(
      and(eq(namedModels.id, namedModelId), eq(projects.ownerId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

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

function revalidateAttachments(recipe: Recipe) {
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.id}`);
  if (recipe.attachedProjectId) {
    revalidatePath(`/projects/${recipe.attachedProjectId}`);
    revalidatePath("/projects");
  }
}

/* ============================================================
   createRecipe
   ============================================================ */

export async function createRecipe(
  raw: CreateRecipeInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid recipe",
    };
  }
  const d = parsed.data;
  const userId = await currentUserId();

  if (d.attachedProjectId && d.attachedNamedModelId) {
    return {
      ok: false,
      error: "A recipe can attach to a project OR a named model, not both.",
    };
  }

  if (d.attachedProjectId) {
    const owned = await verifyProjectOwnership(userId, d.attachedProjectId);
    if (!owned) return { ok: false, error: "Project not found" };
  }
  if (d.attachedNamedModelId) {
    const owned = await verifyNamedModelOwnership(
      userId,
      d.attachedNamedModelId,
    );
    if (!owned) return { ok: false, error: "Named model not found" };
  }

  const isStandalone = !d.attachedProjectId && !d.attachedNamedModelId;

  try {
    const inserted = await db
      .insert(recipes)
      .values({
        ownerId: userId,
        name: d.name,
        bodyType: d.bodyType,
        attachedProjectId: d.attachedProjectId ?? null,
        attachedNamedModelId: d.attachedNamedModelId ?? null,
        isStandalone,
        notesMd: d.notesMd ?? null,
      })
      .returning({ id: recipes.id });
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };

    revalidatePath("/recipes");
    if (d.attachedProjectId) {
      revalidatePath(`/projects/${d.attachedProjectId}`);
      revalidatePath("/projects");
    }
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create recipe",
    };
  }
}

/* ============================================================
   updateRecipe
   ============================================================ */

export async function updateRecipe(
  raw: z.infer<typeof updateSchema>,
): Promise<ActionResult<Recipe>> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid update",
    };
  }
  const { id, ...patch } = parsed.data;
  const userId = await currentUserId();

  const existing = await getOwnedRecipe(userId, id);
  if (!existing) return { ok: false, error: "Recipe not found" };

  const patchValues: Partial<typeof recipes.$inferInsert> = {};
  if (patch.name !== undefined) patchValues.name = patch.name;
  if (patch.bodyType !== undefined) patchValues.bodyType = patch.bodyType;
  if (patch.notesMd !== undefined) {
    patchValues.notesMd = patch.notesMd ?? null;
  }

  if (Object.keys(patchValues).length === 0) {
    return { ok: true, data: existing };
  }

  try {
    const updated = await db
      .update(recipes)
      .set(patchValues)
      .where(eq(recipes.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidateAttachments(row);
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update recipe",
    };
  }
}

/* ============================================================
   deleteRecipe
   ============================================================ */

export async function deleteRecipe(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const userId = await currentUserId();
  const existing = await getOwnedRecipe(userId, parsed.data.id);
  if (!existing) return { ok: false, error: "Recipe not found" };

  try {
    // Zones + steps cascade via FK.
    await db.delete(recipes).where(eq(recipes.id, existing.id));
    revalidateAttachments(existing);
    return { ok: true, data: { id: existing.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete recipe",
    };
  }
}

/* ============================================================
   attachRecipeToProject / NamedModel / detachRecipe
   ============================================================ */

export async function attachRecipeToProject(
  raw: z.infer<typeof attachToProjectSchema>,
): Promise<ActionResult<Recipe>> {
  const parsed = attachToProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { recipeId, projectId } = parsed.data;
  const userId = await currentUserId();

  const recipe = await getOwnedRecipe(userId, recipeId);
  if (!recipe) return { ok: false, error: "Recipe not found" };
  const ownsProject = await verifyProjectOwnership(userId, projectId);
  if (!ownsProject) return { ok: false, error: "Project not found" };

  const previousProjectId = recipe.attachedProjectId;
  const previousNamedModelId = recipe.attachedNamedModelId;

  try {
    const updated = await db
      .update(recipes)
      .set({
        attachedProjectId: projectId,
        attachedNamedModelId: null,
        isStandalone: false,
      })
      .where(eq(recipes.id, recipeId))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${row.id}`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    if (previousProjectId && previousProjectId !== projectId) {
      revalidatePath(`/projects/${previousProjectId}`);
    }
    if (previousNamedModelId) {
      // The named model row lives inside its project workspace.
      const owner = await verifyNamedModelOwnership(
        userId,
        previousNamedModelId,
      );
      if (owner) revalidatePath(`/projects/${owner.projectId}`);
    }
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to attach recipe",
    };
  }
}

export async function attachRecipeToNamedModel(
  raw: z.infer<typeof attachToNamedModelSchema>,
): Promise<ActionResult<Recipe>> {
  const parsed = attachToNamedModelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { recipeId, namedModelId } = parsed.data;
  const userId = await currentUserId();

  const recipe = await getOwnedRecipe(userId, recipeId);
  if (!recipe) return { ok: false, error: "Recipe not found" };
  const owner = await verifyNamedModelOwnership(userId, namedModelId);
  if (!owner) return { ok: false, error: "Named model not found" };

  const previousProjectId = recipe.attachedProjectId;
  const previousNamedModelId = recipe.attachedNamedModelId;

  try {
    const updated = await db
      .update(recipes)
      .set({
        attachedProjectId: null,
        attachedNamedModelId: namedModelId,
        isStandalone: false,
      })
      .where(eq(recipes.id, recipeId))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${row.id}`);
    revalidatePath(`/projects/${owner.projectId}`);
    revalidatePath("/projects");
    if (previousProjectId && previousProjectId !== owner.projectId) {
      revalidatePath(`/projects/${previousProjectId}`);
    }
    if (
      previousNamedModelId &&
      previousNamedModelId !== namedModelId
    ) {
      const prevOwner = await verifyNamedModelOwnership(
        userId,
        previousNamedModelId,
      );
      if (prevOwner) revalidatePath(`/projects/${prevOwner.projectId}`);
    }
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to attach recipe",
    };
  }
}

export async function detachRecipe(
  raw: z.infer<typeof detachSchema>,
): Promise<ActionResult<Recipe>> {
  const parsed = detachSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const userId = await currentUserId();
  const recipe = await getOwnedRecipe(userId, parsed.data.recipeId);
  if (!recipe) return { ok: false, error: "Recipe not found" };

  const previousProjectId = recipe.attachedProjectId;
  const previousNamedModelId = recipe.attachedNamedModelId;

  try {
    const updated = await db
      .update(recipes)
      .set({
        attachedProjectId: null,
        attachedNamedModelId: null,
        isStandalone: true,
      })
      .where(eq(recipes.id, recipe.id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${row.id}`);
    if (previousProjectId) {
      revalidatePath(`/projects/${previousProjectId}`);
      revalidatePath("/projects");
    }
    if (previousNamedModelId) {
      const prevOwner = await verifyNamedModelOwnership(
        userId,
        previousNamedModelId,
      );
      if (prevOwner) revalidatePath(`/projects/${prevOwner.projectId}`);
    }
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to detach recipe",
    };
  }
}
