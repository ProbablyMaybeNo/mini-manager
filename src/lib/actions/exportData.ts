"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  inventoryEntries,
  namedModels,
  palettes,
  projects,
  recipes,
  recipeSteps,
  recipeZones,
  wishlistItems,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

interface ExportPayload {
  __exportVersion: 1;
  __exportedAt: string;
  projects: Array<Record<string, unknown>>;
  namedModels: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  recipeZones: Array<Record<string, unknown>>;
  recipeSteps: Array<Record<string, unknown>>;
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
 * projects, named models, recipes (+ zones + steps), palettes, inventory
 * entries, and wishlist items. NextAuth tables (user / session /
 * account / verificationToken) are deliberately excluded — they're
 * auth internals, not user data.
 *
 * Returns the payload to the caller; the client component handles the
 * actual `Blob` + download trigger. Schema versioning via
 * `__exportVersion: 1` so future-self can re-import.
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

    // Named models, zones, and steps are owner-scoped via their parent
    // tables — pull them after the parents resolve so we can scope the
    // queries by project/recipe id and avoid cross-user bleed.
    const projectIds = projectRows.map((p) => p.id);
    const recipeIds = recipeRows.map((r) => r.id);

    const namedModelRows = projectIds.length
      ? await db
          .select()
          .from(namedModels)
          .where(inArray(namedModels.projectId, projectIds))
      : [];

    const zoneRows = recipeIds.length
      ? await db
          .select()
          .from(recipeZones)
          .where(inArray(recipeZones.recipeId, recipeIds))
      : [];

    const zoneIds = zoneRows.map((z) => z.id);
    const stepRows = zoneIds.length
      ? await db
          .select()
          .from(recipeSteps)
          .where(inArray(recipeSteps.zoneId, zoneIds))
      : [];

    const payload: ExportPayload = {
      __exportVersion: 1,
      __exportedAt: new Date().toISOString(),
      projects: normaliseAll(projectRows),
      namedModels: normaliseAll(namedModelRows),
      recipes: normaliseAll(recipeRows),
      recipeZones: normaliseAll(zoneRows),
      recipeSteps: normaliseAll(stepRows),
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
