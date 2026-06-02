"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { paintNotes } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";
import type { ActionResult } from "@/lib/actions/projects";

const paintIdSchema = z.string().min(1).max(128);

const setSchema = z.object({
  paintId: paintIdSchema,
  note: z.string().max(2_000),
});

/**
 * P15.x — Upsert the painter's per-paint note from the FOCUS panel.
 *
 * Per-paint (not per-step): the note is keyed on (user_id, paint_id), so
 * editing it on one step updates every occurrence of that paint. Called
 * on blur from the client, mirroring the sibling `updateStepNotes`.
 *
 * Behaviour:
 *   - non-empty note → insert a row, or update the existing one for this
 *     (user, paint) pair (upsert on the unique index).
 *   - empty / whitespace-only note → delete the row, clearing the note
 *     and keeping the table sparse.
 *
 * Owner-scoped: the note is always written against the current user, so
 * a painter can only ever read/write their own per-paint notes. There is
 * no cross-user surface to guard — paint ids reference the static catalog,
 * not another painter's rows.
 */
export async function setPaintNote(
  paintId: string,
  note: string,
): Promise<ActionResult<{ paintId: string; cleared: boolean }>> {
  const parsed = setSchema.safeParse({ paintId, note });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid paint note",
    };
  }
  const userId = await currentUserId();
  const trimmed = parsed.data.note.trim();

  try {
    if (trimmed === "") {
      await db
        .delete(paintNotes)
        .where(
          and(
            eq(paintNotes.userId, userId),
            eq(paintNotes.paintId, parsed.data.paintId),
          ),
        );
      revalidatePath("/projects");
      return { ok: true, data: { paintId: parsed.data.paintId, cleared: true } };
    }

    await db
      .insert(paintNotes)
      .values({ userId, paintId: parsed.data.paintId, note: trimmed })
      .onConflictDoUpdate({
        target: [paintNotes.userId, paintNotes.paintId],
        set: { note: trimmed },
      });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save paint note",
    };
  }

  revalidatePath("/projects");
  return { ok: true, data: { paintId: parsed.data.paintId, cleared: false } };
}
