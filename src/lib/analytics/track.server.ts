import "server-only";
import { track } from "@vercel/analytics/server";
import type { AnalyticsEventName, AnalyticsProps } from "./events";

/**
 * Fire a funnel event from a server action / route handler. Never throws
 * — analytics is strictly best-effort and must never break the user
 * action it rides along with. Failures are logged, not surfaced.
 */
export async function trackServer(
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): Promise<void> {
  try {
    await track(event, props);
  } catch (err) {
    console.error(
      `[analytics] server event "${event}" failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Fire a milestone event only when `count` shows this is the FIRST such
 * row for the user (the one just inserted → count of 1). Keeps the
 * "first_*" activation events out of the funnel on every repeat action.
 */
export async function trackFirst(
  count: number,
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): Promise<void> {
  if (count === 1) await trackServer(event, props);
}
