"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  inventoryEntries,
  palettes,
  projects,
  recipes,
  recipeSlots,
  wishlistItems,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

interface ExportPayload {
  __exportVersion: 3;
  __exportedAt: string;
  projects: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  recipeSlots: Array<Record<string, unknown>>;
  palettes: Array<Record<string, unknown>>;
  inventoryEntries: Array<Record<string, unknown>>;
  wishlistItems: Array<Record<string, unknown>>;
}

/**
 * Normalise a row by converting `Date` instances to ISO strings.
 * Drizzle's `timestamp_ms` mode hydrates as `Date`; JSON.stringify
 * would still call `.toISOString()`, but we do it explicitly so the
 * output schema is predictable.
 */
function normalise(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normaliseAll(
  rows: ReadonlyArray<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map(normalise);
}

/**
 * One-shot JSON export of everything the current user owns. Includes
 * projects, recipes (+ slots), palettes, inventory entries, and wishlist
 * items. NextAuth tables (user / session / account / verificationToken)
 * are deliberately excluded — they're auth internals, not user data.
 *
 * P13.4 bumped the schema version to 2 (named_model dropped). The
 * 2026-06-04 unify bumps it to 3: the two-level recipe_zone/recipe_step
 * export is replaced by a flat `recipeSlots` array.
 *
 * Returns the payload to the caller; the client component handles the
 * actual `Blob` + download trigger.
 */
export async function exportAllUserData(): Promise<
  ActionResult<ExportPayload>
> {
  const userId = await currentUserId();
  try {
    const [
      projectRows,
      recipeRows,
      paletteRows,
      inventoryRows,
      wishlistRows,
    ] = await Promise.all([
      db.select().from(projects).where(eq(projects.ownerId, userId)),
      db.select().from(recipes).where(eq(recipes.ownerId, userId)),
      db.select().from(palettes).where(eq(palettes.ownerId, userId)),
      db
        .select()
        .from(inventoryEntries)
        .where(eq(inventoryEntries.ownerId, userId)),
      db.select().from(wishlistItems).where(eq(wishlistItems.ownerId, userId)),
    ]);

    // Slots are owner-scoped via their parent recipes — pull them after
    // the parents resolve so we can scope the query by recipe id and
    // avoid cross-user bleed.
    const recipeIds = recipeRows.map((r) => r.id);

    const slotRows = recipeIds.length
      ? await db
          .select()
          .from(recipeSlots)
          .where(inArray(recipeSlots.recipeId, recipeIds))
      : [];

    const payload: ExportPayload = {
      __exportVersion: 3,
      __exportedAt: new Date().toISOString(),
      projects: normaliseAll(projectRows),
      recipes: normaliseAll(recipeRows),
      recipeSlots: normaliseAll(slotRows),
      palettes: normaliseAll(paletteRows),
      inventoryEntries: normaliseAll(inventoryRows),
      wishlistItems: normaliseAll(wishlistRows),
    };

    return { ok: true, data: payload };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Export failed",
    };
  }
}
