"use client";

import Link from "next/link";
import { Logo } from "@/components/shell";
import { Button } from "@/components/kit";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * Minimal public top nav: logo + Gallery + Pricing + Sign in + a primary
 * "Start for Free" CTA.
 *
 * The ghost links are the returning-visitor doors; the filled CTA is the
 * first-time-visitor door (→ /sign-up) so acquisition doesn't depend on the
 * hero button, which sits below the fold at 1366×768. Kept visible at every
 * width — it wraps onto a second line with the nav's `flex-wrap` rather than
 * hiding behind a breakpoint.
 */
export function PublicHeader() {
  const linkClass =
    "rounded-[6px] px-1 py-0.5 font-h1 text-h1 uppercase tracking-[0.18em] text-fg transition-colors duration-150 hover:text-cyan-lite focus:outline-none focus-visible:text-cyan-lite";
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
      <Logo href="/" size={44} />
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-5">
        <Link href="/gallery" className={linkClass}>
          Gallery
        </Link>
        <Link href="/pricing" className={linkClass}>
          Pricing
        </Link>
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
        <Link href="/sign-up" aria-label="Start for Free">
          <Button
            size="sm"
            onClick={() =>
              trackClient(AnalyticsEvent.CtaStartForFree, { location: "header" })
            }
          >
            Start for Free
          </Button>
        </Link>
      </nav>
    </header>
  );
}
