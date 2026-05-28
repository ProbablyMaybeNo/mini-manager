"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  recipes,
  recipeSteps,
  recipeZones,
  type Recipe,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";
import { validatePaletteColors } from "@/lib/palettes/cascade";

/* ============================================================
   listRecipesForSendTo — lightweight read action surfaced to the
   client modal. Returns the painter's recipes + zones in a single
   round-trip so the modal renders without a chained `useEffect`.
   ============================================================ */

export interface SendToRecipeOption {
  id: string;
  name: string;
  zones: ReadonlyArray<{ id: string; name: string; position: number }>;
}

export async function listRecipesForSendTo(): Promise<
  ActionResult<ReadonlyArray<SendToRecipeOption>>
> {
  const userId = await currentUserId();
  try {
    const recipeRows = await db
      .select({ id: recipes.id, name: recipes.name })
      .from(recipes)
      .where(eq(recipes.ownerId, userId))
      .orderBy(desc(recipes.updatedAt));
    if (recipeRows.length === 0) {
      return { ok: true, data: [] };
    }
    const recipeIds = recipeRows.map((r) => r.id);
    const zoneRows = await db
      .select({
        id: recipeZones.id,
        recipeId: recipeZones.recipeId,
        name: recipeZones.name,
        position: recipeZones.position,
      })
      .from(recipeZones)
      .where(inArray(recipeZones.recipeId, recipeIds))
      .orderBy(asc(recipeZones.position));
    const zonesByRecipe = new Map<
      string,
      Array<{ id: string; name: string; position: number }>
    >();
    for (const z of zoneRows) {
      const arr = zonesByRecipe.get(z.recipeId) ?? [];
      arr.push({ id: z.id, name: z.name, position: z.position });
      zonesByRecipe.set(z.recipeId, arr);
    }
    const out: SendToRecipeOption[] = recipeRows.map((r) => ({
      id: r.id,
      name: r.name,
      zones: zonesByRecipe.get(r.id) ?? [],
    }));
    return { ok: true, data: out };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to list recipes",
    };
  }
}

const HEX_PATTERN = /^#[0-9A-F]{6}$/;

const swatchSchema = z.object({
  hex: z.string(),
  paintId: z.string().min(1).max(64).nullish(),
  name: z.string().max(120).optional(),
});

const sendSchema = z
  .object({
    swatches: z.array(swatchSchema).min(1, "Palette has no swatches"),
    /** Existing-recipe target: pick a recipe + an optional zone. When
     *  the zone is omitted, a new zone named after the source tool is
     *  created. */
    targetRecipeId: z.string().min(1).max(64).optional(),
    targetZoneId: z.string().min(1).max(64).optional(),
    /** Create-new-recipe target: ignored if targetRecipeId is set. */
    newRecipeName: z.string().trim().min(1).max(120).optional(),
    /** Optional: the name of the zone we'd create if the user picked
     *  "new zone" from the modal (or when creating a new recipe). */
    zoneName: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (d) => Boolean(d.targetRecipeId) !== Boolean(d.newRecipeName),
    {
      message: "Send to recipe needs either targetRecipeId OR newRecipeName.",
    },
  )
  .refine(
    (d) => !(d.targetZoneId && d.newRecipeName),
    { message: "Cannot pick a zone when creating a new recipe." },
  );

export type SendPaletteInput = z.input<typeof sendSchema>;

export interface SendPaletteResult {
  recipeId: string;
  zoneId: string;
  insertedStepIds: ReadonlyArray<string>;
}

/* ============================================================
   sendPaletteToRecipe
   ============================================================ */

export async function sendPaletteToRecipe(
  raw: SendPaletteInput,
): Promise<ActionResult<SendPaletteResult>> {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;
  const userId = await currentUserId();

  // Run the swatch hex array through the palette validator so we get the
  // same #RRGGBB normalisation + length checks the save-palette flow uses.
  const validated = validatePaletteColors(
    d.swatches.map((s) => s.hex),
    null,
  );
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }
  const normalisedHexes = validated.colorHexes;
  if (!normalisedHexes.every((h) => HEX_PATTERN.test(h))) {
    return { ok: false, error: "Palette contains a malformed hex." };
  }

  // Branch 1 — create a brand-new standalone recipe.
  if (d.newRecipeName) {
    return createRecipeFromPalette({
      userId,
      name: d.newRecipeName,
      zoneName: d.zoneName ?? "Palette",
      hexes: normalisedHexes,
      paintIds: d.swatches.map((s) => s.paintId ?? null),
    });
  }

  // Branch 2 — append to an existing recipe.
  if (!d.targetRecipeId) {
    // Shouldn't reach here — the refine() above enforces it.
    return { ok: false, error: "Missing target recipe" };
  }
  return appendPaletteToRecipe({
    userId,
    recipeId: d.targetRecipeId,
    zoneId: d.targetZoneId ?? null,
    zoneName: d.zoneName ?? "Palette",
    hexes: normalisedHexes,
    paintIds: d.swatches.map((s) => s.paintId ?? null),
  });
}

/* ============================================================
   Helpers
   ============================================================ */

interface CreateArgs {
  userId: string;
  name: string;
  zoneName: string;
  hexes: ReadonlyArray<string>;
  paintIds: ReadonlyArray<string | null>;
}

async function createRecipeFromPalette(
  args: CreateArgs,
): Promise<ActionResult<SendPaletteResult>> {
  try {
    const recipeRows = await db
      .insert(recipes)
      .values({
        ownerId: args.userId,
        name: args.name,
        bodyType: "infantry",
        isStandalone: true,
      })
      .returning();
    const recipe = recipeRows[0];
    if (!recipe) return { ok: false, error: "Recipe insert returned no row" };

    const zoneRows = await db
      .insert(recipeZones)
      .values({
        recipeId: recipe.id,
        name: args.zoneName,
        position: 0,
        silhouetteZoneId: null,
      })
      .returning();
    const zone = zoneRows[0];
    if (!zone) return { ok: false, error: "Zone insert returned no row" };

    const inserted = await insertStepsForPalette({
      zoneId: zone.id,
      startPosition: 0,
      hexes: args.hexes,
      paintIds: args.paintIds,
    });

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${recipe.id}`);
    return {
      ok: true,
      data: {
        recipeId: recipe.id,
        zoneId: zone.id,
        insertedStepIds: inserted,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create recipe",
    };
  }
}

interface AppendArgs {
  userId: string;
  recipeId: string;
  zoneId: string | null;
  zoneName: string;
  hexes: ReadonlyArray<string>;
  paintIds: ReadonlyArray<string | null>;
}

async function appendPaletteToRecipe(
  args: AppendArgs,
): Promise<ActionResult<SendPaletteResult>> {
  // Ownership check on the recipe.
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(
      and(eq(recipes.id, args.recipeId), eq(recipes.ownerId, args.userId)),
    )
    .limit(1);
  const recipe: Recipe | undefined = recipeRows[0];
  if (!recipe) return { ok: false, error: "Recipe not found" };

  // Resolve the target zone — either the one supplied, or a brand-new
  // zone appended to the recipe.
  let zoneId: string;
  if (args.zoneId) {
    const zoneRows = await db
      .select({ id: recipeZones.id, recipeId: recipeZones.recipeId })
      .from(recipeZones)
      .where(eq(recipeZones.id, args.zoneId))
      .limit(1);
    const zone = zoneRows[0];
    if (!zone || zone.recipeId !== recipe.id) {
      return { ok: false, error: "Zone not found in this recipe" };
    }
    zoneId = zone.id;
  } else {
    const positionRows = await db
      .select({ maxPos: max(recipeZones.position) })
      .from(recipeZones)
      .where(eq(recipeZones.recipeId, recipe.id));
    const currentMax = positionRows[0]?.maxPos ?? null;
    const nextPosition = currentMax === null ? 0 : currentMax + 1;
    const inserted = await db
      .insert(recipeZones)
      .values({
        recipeId: recipe.id,
        name: args.zoneName,
        position: nextPosition,
        silhouetteZoneId: null,
      })
      .returning({ id: recipeZones.id });
    const newZone = inserted[0];
    if (!newZone) return { ok: false, error: "Zone insert returned no row" };
    zoneId = newZone.id;
  }

  // Next position for the appended steps.
  const positionRows = await db
    .select({ maxPos: max(recipeSteps.position) })
    .from(recipeSteps)
    .where(eq(recipeSteps.zoneId, zoneId));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const startPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const insertedStepIds = await insertStepsForPalette({
      zoneId,
      startPosition,
      hexes: args.hexes,
      paintIds: args.paintIds,
    });
    revalidatePath("/recipes");
    revalidatePath(`/recipes/${recipe.id}`);
    return {
      ok: true,
      data: { recipeId: recipe.id, zoneId, insertedStepIds },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to append palette",
    };
  }
}

interface InsertStepsArgs {
  zoneId: string;
  startPosition: number;
  hexes: ReadonlyArray<string>;
  paintIds: ReadonlyArray<string | null>;
}

async function insertStepsForPalette(
  args: InsertStepsArgs,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < args.hexes.length; i++) {
    const hex = args.hexes[i];
    const paintId = args.paintIds[i] ?? null;
    if (!hex) continue;
    const row = await db
      .insert(recipeSteps)
      .values({
        zoneId: args.zoneId,
        position: args.startPosition + i,
        technique: "basecoat",
        paintId: paintId,
        customColorHex: paintId ? null : hex,
      })
      .returning({ id: recipeSteps.id });
    const id = row[0]?.id;
    if (id) ids.push(id);
  }
  return ids;
}
