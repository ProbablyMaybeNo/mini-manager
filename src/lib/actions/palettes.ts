"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { palettes, paletteSources, type Palette } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import { isProUser } from "@/lib/billing/enforce";
import type { ActionResult } from "@/lib/actions/projects";
import { validatePaletteColors } from "@/lib/palettes/cascade";

/**
 * Gating-layer — APPLYING a tool result (saving a palette) is Pro-only;
 * free users can still USE the colour tools, just not persist the output.
 * Mirrors the free-tier limit shape so the UI can render an inline
 * "Upgrade →". Inert while BILLING_ENFORCED is false (isProUser returns
 * true for everyone until Stripe is live).
 */
const PRO_FEATURE_ERROR =
  "Saving palettes unlocks when you sponsor the Mainframe.";

const paletteIdSchema = z.string().min(1).max(64);

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  source: z.enum(paletteSources),
  colorHexes: z.array(z.string()).min(1, "Palette needs at least one colour."),
  paintIds: z.array(z.string().nullable()).optional().nullable(),
});

export type CreatePaletteInput = z.input<typeof createSchema>;

const deleteSchema = z.object({
  id: paletteIdSchema,
});

const renameSchema = z.object({
  id: paletteIdSchema,
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
});

async function getOwnedPalette(
  userId: string,
  id: string,
): Promise<Palette | null> {
  const rows = await db
    .select()
    .from(palettes)
    .where(and(eq(palettes.id, id), eq(palettes.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/* ============================================================
   createPalette
   ============================================================ */

export async function createPalette(
  raw: CreatePaletteInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid palette",
    };
  }
  const d = parsed.data;
  const userId = await currentUserId();

  // Gating-layer — Save Palette is a Pro-only "apply tool result" action.
  if (!(await isProUser(userId))) {
    return { ok: false, error: PRO_FEATURE_ERROR, upgradeUrl: "/pricing" };
  }

  const validated = validatePaletteColors(d.colorHexes, d.paintIds ?? null);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  try {
    const inserted = await db
      .insert(palettes)
      .values({
        ownerId: userId,
        name: d.name,
        source: d.source,
        colorHexes: JSON.stringify(validated.colorHexes),
        paintIds: JSON.stringify(validated.paintIds),
      })
      .returning({ id: palettes.id });
    const row = inserted[0];
    if (!row) return { ok: false, error: "Insert returned no row" };

    revalidatePath("/tools");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create palette",
    };
  }
}

/* ============================================================
   deletePalette
   ============================================================ */

export async function deletePalette(
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
  const existing = await getOwnedPalette(userId, parsed.data.id);
  if (!existing) return { ok: false, error: "Palette not found" };

  try {
    await db.delete(palettes).where(eq(palettes.id, existing.id));
    revalidatePath("/tools");
    return { ok: true, data: { id: existing.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete palette",
    };
  }
}

/* ============================================================
   renamePalette
   ============================================================ */

export async function renamePalette(
  raw: z.infer<typeof renameSchema>,
): Promise<ActionResult<Palette>> {
  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { id, name } = parsed.data;
  const userId = await currentUserId();
  const existing = await getOwnedPalette(userId, id);
  if (!existing) return { ok: false, error: "Palette not found" };

  try {
    const updated = await db
      .update(palettes)
      .set({ name })
      .where(eq(palettes.id, id))
      .returning();
    const row = updated[0];
    if (!row) return { ok: false, error: "Update returned no row" };
    revalidatePath("/tools");
    return { ok: true, data: row };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rename palette",
    };
  }
}
