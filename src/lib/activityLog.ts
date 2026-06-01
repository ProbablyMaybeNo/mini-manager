import { db } from "@/db/client";
import { activityLog, type ActivityLogKind } from "@/db/schema";

/**
 * P14.1 — Single-call activity emit helper.
 *
 * Server actions throughout the app call `logActivity(userId, kind, refId)`
 * after a successful mutation to drop a row into the append-only
 * `activity_log` table. The dashboard PLANNER widgets (activity stream,
 * streak counter, heatmap) all read off that table.
 *
 * Design notes:
 *   - Best-effort, fire-and-forget from the caller's perspective: the
 *     emit failing must never roll back the underlying mutation. If
 *     the insert throws, we swallow + log to console — the painter
 *     loses an activity row, not their work. Tests assert the happy
 *     path; real-world DB pressure shouldn't surface as an action
 *     failure for a non-critical write.
 *   - `refId` is optional + free-form. Each kind has its own
 *     convention (see schema.ts comment on `activity_log.refId`).
 *   - No row deduplication. A painter who bumps the same stage 6
 *     times in a row gets 6 rows — the heatmap counts them, the
 *     activity stream caps at 20 so the noise washes out.
 */
export async function logActivity(
  userId: string,
  kind: ActivityLogKind,
  refId?: string | null,
): Promise<void> {
  try {
    await db.insert(activityLog).values({
      userId,
      kind,
      refId: refId ?? null,
    });
  } catch (err) {
    // Best-effort write — the painter's primary action already
    // succeeded. Surface for ops without bubbling.
    // eslint-disable-next-line no-console
    console.warn("[activityLog] insert failed", err);
  }
}
