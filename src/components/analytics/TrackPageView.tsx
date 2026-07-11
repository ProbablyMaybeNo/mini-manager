"use client";

import { useEffect } from "react";
import { trackClient } from "@/lib/analytics/track.client";
import type { AnalyticsEventName, AnalyticsProps } from "@/lib/analytics/events";

/**
 * Fire a single funnel impression event on mount. Drop into an otherwise
 * server-rendered page (e.g. /pricing) that needs a `*_view` event without
 * turning the whole page into a client component. Renders nothing.
 */
export function TrackPageView({
  event,
  props,
}: {
  event: AnalyticsEventName;
  props?: AnalyticsProps;
}) {
  useEffect(() => {
    trackClient(event, props);
    // Fire once per mount; event/props are stable for a given page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
