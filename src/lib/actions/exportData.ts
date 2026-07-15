"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  activityLog,
  events,
  feedback,
  imports,
  inspoImages,
  inventoryEntries,
  paintNotes,
  paintSessions,
  palettes,
  projectImages,
  projects,
  recipeInspo,
  recipes,
  recipeSlots,
  recipeStepCompletion,
  wishlistItems,
} from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

interface ExportPayload {
  __exportVersion: 4;
  __exportedAt: string;
  projects: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  recipeSlots: Array<Record<string, unknown>>;
  recipeInspo: Array<Record<string, unknown>>;
  recipeStepCompletion: Array<Record<string, unknown>>;
  palettes: Array<Record<string, unknown>>;
  inventoryEntries: Array<Record<string, unknown>>;
  wishlistItems: Array<Record<string, unknown>>;
  paintNotes: Array<Record<string, unknown>>;
  paintSessions: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  activityLog: Array<Record<string, unknown>>;
  projectImages: Array<Record<string, unknown>>;
  inspoImages: Array<Record<string, unknown>>;
  imports: Array<Record<string, unknown>>;
  feedback: Array<Record<string, unknown>>;
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
 * One-shot JSON export of everything the current user owns — the GDPR /
 * data-portability payload. Covers every owner-scoped table: projects,
 * recipes (+ slots, inspo links, step-completion), palettes, inventory,
 * wishlist, paint notes, paint sessions, calendar events, activity log,
 * project + inspiration images, imports, and tester feedback. NextAuth
 * tables (user / session / account / verificationToken) and the
 * rate-limit/meta counters are deliberately excluded — auth internals /
 * infra, not user data.
 *
 * P13.4 bumped the version to 2 (named_model dropped); the 2026-06-04 unify
 * bumped it to 3 (flat recipeSlots). Version 4 (G1) completes the export —
 * the previous payload covered only 6 of the 16 owner-scoped tables, so a
 * data-export request silently omitted most of a user's data.
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
      paintNoteRows,
      paintSessionRows,
      eventRows,
      activityRows,
      projectImageRows,
      inspoImageRows,
      importRows,
      stepCompletionRows,
      feedbackRows,
    ] = await Promise.all([
      db.select().from(projects).where(eq(projects.ownerId, userId)),
      db.select().from(recipes).where(eq(recipes.ownerId, userId)),
      db.select().from(palettes).where(eq(palettes.ownerId, userId)),
      db
        .select()
        .from(inventoryEntries)
        .where(eq(inventoryEntries.ownerId, userId)),
      db.select().from(wishlistItems).where(eq(wishlistItems.ownerId, userId)),
      db.select().from(paintNotes).where(eq(paintNotes.userId, userId)),
      db.select().from(paintSessions).where(eq(paintSessions.userId, userId)),
      db.select().from(events).where(eq(events.userId, userId)),
      db.select().from(activityLog).where(eq(activityLog.userId, userId)),
      db.select().from(projectImages).where(eq(projectImages.ownerId, userId)),
      db.select().from(inspoImages).where(eq(inspoImages.userId, userId)),
      db.select().from(imports).where(eq(imports.ownerId, userId)),
      db
        .select()
        .from(recipeStepCompletion)
        .where(eq(recipeStepCompletion.userId, userId)),
      db.select().from(feedback).where(eq(feedback.userId, userId)),
    ]);

    // Recipe-child rows (slots + inspo links) are owner-scoped via their
    // parent recipes — pull them after the parents resolve so we can scope
    // the query by recipe id and avoid cross-user bleed.
    const recipeIds = recipeRows.map((r) => r.id);

    const [slotRows, inspoRows] = recipeIds.length
      ? await Promise.all([
          db
            .select()
            .from(recipeSlots)
            .where(inArray(recipeSlots.recipeId, recipeIds)),
          db
            .select()
            .from(recipeInspo)
            .where(inArray(recipeInspo.recipeId, recipeIds)),
        ])
      : [[], []];

    const payload: ExportPayload = {
      __exportVersion: 4,
      __exportedAt: new Date().toISOString(),
      projects: normaliseAll(projectRows),
      recipes: normaliseAll(recipeRows),
      recipeSlots: normaliseAll(slotRows),
      recipeInspo: normaliseAll(inspoRows),
      recipeStepCompletion: normaliseAll(stepCompletionRows),
      palettes: normaliseAll(paletteRows),
      inventoryEntries: normaliseAll(inventoryRows),
      wishlistItems: normaliseAll(wishlistRows),
      paintNotes: normaliseAll(paintNoteRows),
      paintSessions: normaliseAll(paintSessionRows),
      events: normaliseAll(eventRows),
      activityLog: normaliseAll(activityRows),
      projectImages: normaliseAll(projectImageRows),
      inspoImages: normaliseAll(inspoImageRows),
      imports: normaliseAll(importRows),
      feedback: normaliseAll(feedbackRows),
    };

    return { ok: true, data: payload };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Export failed",
    };
  }
}
