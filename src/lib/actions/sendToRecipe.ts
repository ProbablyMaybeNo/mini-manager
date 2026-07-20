"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes, recipeSlots, type Recipe } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { isProUser } from "@/lib/billing/enforce";
import { trackServer } from "@/lib/analytics/track.server";
import { AnalyticsEvent } from "@/lib/analytics/events";
import type { ActionResult } from "@/lib/actions/projects";
import { validatePaletteColors } from "@/lib/palettes/cascade";

/**
 * Gating-layer — `AssignToRecipeDialog` (this action's only caller) is
 * shared by two surfaces that must NOT share a gate:
 *
 *   - "toolHandoff" — a colour tool's per-swatch ASSIGN / send-to-recipe
 *     (AssignPaintMenu, and the Wheel/Dropper/Stacking "Create/Assign
 *     recipe" buttons). This is the subscriber-only "send-from-tools
 *     hand-off" named in docs/SUBSCRIPTION_PAYWALL.md — gated.
 *   - "library" — the Library paint panel's plain "Add to Recipe" action.
 *     Adding paints to a recipe is base-app functionality and must stay
 *     free even once BILLING_ENFORCED is on.
 *
 * Defaults to "toolHandoff" (the gated, higher-friction option) so any
 * caller that forgets to pass `surface` fails closed rather than silently
 * opening a free bypass.
 */
const PRO_FEATURE_ERROR =
  "Sending palettes to a recipe is a Pro feature. Upgrade to apply your tool results.";

/* ============================================================
   listRecipesForSendTo — lightweight read action surfaced to the
   client modal. Returns the painter's recipes so the modal renders
   without a chained `useEffect`. Flat model: the palette appends as a
   run of slots, so there's no per-recipe zone list to pick from.
   ============================================================ */

export interface SendToRecipeOption {
  id: string;
  name: string;
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
    const out: SendToRecipeOption[] = recipeRows.map((r) => ({
      id: r.id,
      name: r.name,
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
    /** Existing-recipe target — appends the palette as a run of slots. */
    targetRecipeId: z.string().min(1).max(64).optional(),
    /** Create-new-recipe target: ignored if targetRecipeId is set. */
    newRecipeName: z.string().trim().min(1).max(120).optional(),
    /** Which surface is calling — see the gating-layer doc comment above.
     *  Defaults to the gated "toolHandoff" surface. */
    surface: z.enum(["toolHandoff", "library"]).default("toolHandoff"),
  })
  .refine(
    (d) => Boolean(d.targetRecipeId) !== Boolean(d.newRecipeName),
    {
      message: "Send to recipe needs either targetRecipeId OR newRecipeName.",
    },
  );

export type SendPaletteInput = z.input<typeof sendSchema>;

export interface SendPaletteResult {
  recipeId: string;
  insertedSlotIds: ReadonlyArray<string>;
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

  // Gating-layer — gated for a tool hand-off, free for the Library's plain
  // "Add to Recipe" (see the doc comment above `PRO_FEATURE_ERROR`).
  if (d.surface === "toolHandoff" && !(await isProUser(userId))) {
    return { ok: false, error: PRO_FEATURE_ERROR, upgradeUrl: "/pricing" };
  }

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
    const res = await createRecipeFromPalette({
      userId,
      name: d.newRecipeName,
      hexes: normalisedHexes,
      paintIds: d.swatches.map((s) => s.paintId ?? null),
    });
    if (res.ok) await trackServer(AnalyticsEvent.ToolResultSaved, { mode: "new" });
    return res;
  }

  // Branch 2 — append to an existing recipe.
  if (!d.targetRecipeId) {
    // Shouldn't reach here — the refine() above enforces it.
    return { ok: false, error: "Missing target recipe" };
  }
  const res = await appendPaletteToRecipe({
    userId,
    recipeId: d.targetRecipeId,
    hexes: normalisedHexes,
    paintIds: d.swatches.map((s) => s.paintId ?? null),
  });
  if (res.ok) await trackServer(AnalyticsEvent.ToolResultSaved, { mode: "append" });
  return res;
}

/* ============================================================
   Helpers
   ============================================================ */

interface CreateArgs {
  userId: string;
  name: string;
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

    const inserted = await insertSlotsForPalette({
      recipeId: recipe.id,
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
        insertedSlotIds: inserted,
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

  // Next position for the appended slots.
  const positionRows = await db
    .select({ maxPos: max(recipeSlots.position) })
    .from(recipeSlots)
    .where(eq(recipeSlots.recipeId, recipe.id));
  const currentMax = positionRows[0]?.maxPos ?? null;
  const startPosition = currentMax === null ? 0 : currentMax + 1;

  try {
    const insertedSlotIds = await insertSlotsForPalette({
      recipeId: recipe.id,
      startPosition,
      hexes: args.hexes,
      paintIds: args.paintIds,
    });
    revalidatePath("/recipes");
    revalidatePath(`/recipes/${recipe.id}`);
    return {
      ok: true,
      data: { recipeId: recipe.id, insertedSlotIds },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to append palette",
    };
  }
}

interface InsertSlotsArgs {
  recipeId: string;
  startPosition: number;
  hexes: ReadonlyArray<string>;
  paintIds: ReadonlyArray<string | null>;
}

async function insertSlotsForPalette(
  args: InsertSlotsArgs,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < args.hexes.length; i++) {
    const hex = args.hexes[i];
    const paintId = args.paintIds[i] ?? null;
    if (!hex) continue;
    const row = await db
      .insert(recipeSlots)
      .values({
        recipeId: args.recipeId,
        position: args.startPosition + i,
        technique: "basecoat",
        paintId: paintId,
        customColorHex: paintId ? null : hex,
      })
      .returning({ id: recipeSlots.id });
    const id = row[0]?.id;
    if (id) ids.push(id);
  }
  return ids;
}
