import { track } from "@vercel/analytics";
import type { AnalyticsEventName, AnalyticsProps } from "./events";

/**
 * Fire a funnel event from a client component. Best-effort and
 * fire-and-forget (the Vercel client queues + beacons it) — wrapped so a
 * failure can never bubble into a click handler. Import only from "use
 * client" components; server actions use `trackServer` instead.
 */
export function trackClient(
  event: AnalyticsEventName,
  props?: AnalyticsProps,
): void {
  try {
    track(event, props);
  } catch {
    // best-effort: analytics must never break an interaction
  }
}
