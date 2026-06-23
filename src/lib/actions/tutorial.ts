"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { currentUserId } from "@/lib/auth-stub";

export type TutorialActionResult = { ok: true } | { ok: false; message: string };

/**
 * Mark the first-run walkthrough as seen for the signed-in user. Fired once
 * when the painter finishes the last step OR skips the tour — both count as
 * "don't auto-show again". Stamps `tutorialCompletedAt` with now; idempotent
 * (re-stamping just bumps the timestamp, which is harmless).
 *
 * The re-trigger entry in the side panel does NOT clear this — restarting the
 * tour on demand is a transient client action, not a reset of the flag, so a
 * deliberate replay never re-arms the auto-show.
 */
export async function completeTutorialAction(): Promise<TutorialActionResult> {
  const userId = await currentUserId();
  try {
    await db
      .update(users)
      .set({ tutorialCompletedAt: new Date() })
      .where(eq(users.id, userId));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Failed to record tutorial state",
    };
  }
}
