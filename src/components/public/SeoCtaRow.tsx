"use client";

import Link from "next/link";
import { Button } from "@/components/kit";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * The two doors off an SEO landing page: sign up, or see the proof first.
 *
 * `location` names the page so the funnel can tell which search-intent page
 * converted — the same `CtaStartForFree` + `location` shape `LandingView` and
 * `PublicHeader` already use.
 */
export function SeoCtaRow({ location }: { location: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link href="/sign-up">
        <Button
          size="lg"
          onClick={() => trackClient(AnalyticsEvent.CtaStartForFree, { location })}
        >
          Get Started
        </Button>
      </Link>
      <Link href="/gallery">
        <Button size="lg" variant="secondary">
          See the gallery
        </Button>
      </Link>
    </div>
  );
}
