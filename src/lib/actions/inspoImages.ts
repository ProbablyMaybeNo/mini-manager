"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { inspoImages } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

/**
 * P14.7 — Inspo gallery server actions.
 *
 * Four CRUD actions backing the dashboard widget:
 *
 *   addInspoImage         — paste URL + optional alt text into the
 *                           "Add inspo" form below the gallery grid.
 *   toggleInspoDisplay    — show / hide a row via the Manage modal.
 *   deleteInspoImage      — remove a row.
 *   reorderInspoImages    — write a new explicit ordering after the
 *                           painter drags rows in the Manage modal.
 *
 * Locked rule: this layer NEVER fetches the URL. It validates the
 * URL shape only — the painter pastes external links (Pinterest /
 * IG / ArtStation) and the dashboard renders them via `<img
 * src={url}>`. No storage, no thumbnails, no proxy.
 */

/**
 * URL-shape validator. The widget only accepts http / https URLs
 * because <img src="..."> won't render anything else in a useful way.
 * We don't whitelist hosts — the painter pastes whatever they want,
 * including private CDNs.
 */
const urlSchema = z
  .string()
  .trim()
  .min(1, "Paste a URL")
  .max(2_048, "URL is too long")
  .refine((v) => {
    try {
      const parsed = new URL(v);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Paste a valid http(s) URL");

const altTextSchema = z
  .string()
  .max(280, "Alt text is too long")
  .trim()
  .nullish()
  .transform((v) => (v == null || v === "" ? null : v));

const idSchema = z.string().min(1).max(64);

const addSchema = z.object({
  url: urlSchema,
  altText: altTextSchema,
});

export type AddInspoImageInput = z.infer<typeof addSchema>;

export async function addInspoImage(
  raw: AddInspoImageInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid inspo image",
    };
  }
  const { url, altText } = parsed.data;
  const userId = await currentUserId();

  // Place the new row at the end of the painter's current order.
  // Empty gallery → position 0; otherwise max+1.
  const nextPositionRow = await db
    .select({ max: max(inspoImages.positionIndex) })
    .from(inspoImages)
    .where(eq(inspoImages.userId, userId));
  const nextPosition = (nextPositionRow[0]?.max ?? -1) + 1;

  try {
    const inserted = await db
      .insert(inspoImages)
      .values({
        userId,
        url,
        altText: altText ?? null,
        positionIndex: nextPosition,
        isDisplayed: true,
      })
      .returning({ id: inspoImages.id });
    const row = inserted[0];
    if (!row) return { ok: false, error: "Failed to add inspo image" };
    revalidatePath("/projects");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add inspo image",
    };
  }
}

const toggleSchema = z.object({
  id: idSchema,
  isDisplayed: z.boolean(),
});

export async function toggleInspoDisplay(
  raw: z.infer<typeof toggleSchema>,
): Promise<ActionResult<{ id: string; isDisplayed: boolean }>> {
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid toggle",
    };
  }
  const { id, isDisplayed } = parsed.data;
  const userId = await currentUserId();

  const owned = await db
    .select({ id: inspoImages.id })
    .from(inspoImages)
    .where(and(eq(inspoImages.id, id), eq(inspoImages.userId, userId)))
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Inspo image not found" };

  try {
    await db
      .update(inspoImages)
      .set({ isDisplayed })
      .where(eq(inspoImages.id, id));
    revalidatePath("/projects");
    return { ok: true, data: { id, isDisplayed } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle display",
    };
  }
}

const deleteSchema = z.object({
  id: idSchema,
});

export async function deleteInspoImage(
  raw: z.infer<typeof deleteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid id",
    };
  }
  const { id } = parsed.data;
  const userId = await currentUserId();

  const owned = await db
    .select({ id: inspoImages.id })
    .from(inspoImages)
    .where(and(eq(inspoImages.id, id), eq(inspoImages.userId, userId)))
    .limit(1);
  if (!owned[0]) return { ok: false, error: "Inspo image not found" };

  try {
    await db.delete(inspoImages).where(eq(inspoImages.id, id));
    revalidatePath("/projects");
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete",
    };
  }
}

const reorderSchema = z.object({
  /** Ordered list of inspo-image ids representing the painter's new
   *  drag-order. Every id must belong to the calling user; ids not in
   *  the list keep their position. */
  orderedIds: z.array(idSchema).min(1).max(500),
});

export async function reorderInspoImages(
  raw: z.infer<typeof reorderSchema>,
): Promise<ActionResult<{ updated: number }>> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reorder",
    };
  }
  const { orderedIds } = parsed.data;
  const userId = await currentUserId();

  // Ownership: fetch every id the user owns; reject the request if
  // even one id in the list is not theirs (prevents a hostile actor
  // from sneaking a peek at another user's gallery via ordering).
  const ownedRows = await db
    .select({ id: inspoImages.id })
    .from(inspoImages)
    .where(eq(inspoImages.userId, userId))
    .orderBy(asc(inspoImages.positionIndex));
  const ownedIds = new Set(ownedRows.map((r) => r.id));
  for (const id of orderedIds) {
    if (!ownedIds.has(id)) {
      return { ok: false, error: "Inspo image not found" };
    }
  }

  try {
    // Sequential per-row update — small payload (capped at 500 ids)
    // and libsql doesn't expose a batched UPDATE in our drizzle setup.
    let updated = 0;
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(inspoImages)
        .set({ positionIndex: i })
        .where(eq(inspoImages.id, orderedIds[i]!));
      updated++;
    }
    revalidatePath("/projects");
    return { ok: true, data: { updated } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reorder",
    };
  }
}
