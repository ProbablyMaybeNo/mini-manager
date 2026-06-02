import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { paintNotes } from "@/db/schema";

/**
 * P15.x — Resolve the painter's per-paint notes for the given paint ids.
 *
 * Returns a Map<paintId, note> so the dashboard can thread each paint's
 * global note into the FOCUS view model in O(1) lookups. Per-paint notes
 * follow the paint everywhere it's pinned, so a single note can decorate
 * multiple steps that share the same paint.
 *
 * Scoped to BOTH the user and the supplied paint-id list so a painter
 * only ever sees their own notes, and the query stays bounded to the
 * active recipe's paints (no full-table scan). Rows with a null/empty
 * note are skipped — the action clears notes by deleting the row, but we
 * defend against a stray empty value too.
 *
 * An empty `paintIds` short-circuits to an empty map — the dashboard
 * passes the focused recipe's paint ids, which is empty for a recipe
 * with no paint-backed steps.
 */
export async function getPaintNotesMap(
  userId: string,
  paintIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  if (paintIds.length === 0) return new Map();

  const rows = await db
    .select({ paintId: paintNotes.paintId, note: paintNotes.note })
    .from(paintNotes)
    .where(
      and(
        eq(paintNotes.userId, userId),
        inArray(paintNotes.paintId, paintIds as string[]),
      ),
    );

  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.note != null && r.note !== "") map.set(r.paintId, r.note);
  }
  return map;
}
