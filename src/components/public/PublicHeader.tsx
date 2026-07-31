"use client";

import Link from "next/link";
import { Logo } from "@/components/shell";
import { Button } from "@/components/kit";
import { trackClient } from "@/lib/analytics/track.client";
import { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * Minimal public top nav.
 *
 * On phones the nav is exactly two doors: a small ghost "Sign in" and the
 * filled "Get Started" CTA — the old four-item row wrapped, dropping the CTA
 * onto a second line underneath the ghost links (Ross, 2026-07-27). Gallery and
 * Sponsor return at ≥sm where there's room for them on one line; they're still
 * reachable from the footer on every width.
 */
export function PublicHeader() {
  // Smaller + non-wrapping on phones: at the full h1 size "Sign in" broke
  // across two lines next to the CTA.
  // min-h-11 gives these a full-height tap area without changing how they look —
  // "Sign in" measured 72×24, exactly on the WCAG 2.5.8 floor and 20px under the
  // platform target, in a header with room to spare (paywall/round-5 MUX5-006).
  const linkClass =
    "inline-flex min-h-11 items-center whitespace-nowrap rounded-[6px] px-1 font-h1 text-body uppercase tracking-[0.1em] text-fg transition-colors duration-150 hover:text-cyan-lite focus:outline-none focus-visible:text-cyan-lite sm:text-h1 sm:tracking-[0.18em]";
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
      {/* Mark-only on phones: the ~155px "MINI MAINFRAME" wordmark plus both
          nav doors overran 375px, and the hero's animated CRT directly below
          spells the name out anyway. */}
      <Logo href="/" size={40} markOnly className="sm:hidden" />
      <Logo href="/" size={44} className="hidden sm:inline-flex" />
      <nav className="flex items-center gap-3 sm:gap-5">
        <Link href="/gallery" className={`hidden sm:inline-flex ${linkClass}`}>
          Gallery
        </Link>
        <Link href="/pricing" className={`hidden sm:inline-flex ${linkClass}`}>
          Sponsor
        </Link>
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
        <Link href="/sign-up" aria-label="Get started">
          <Button
            size="sm"
            // whitespace-nowrap: at 375px the two-word label broke onto a second
            // line and pushed the button past the right edge.
            className="whitespace-nowrap px-2 sm:px-2.5"
            onClick={() =>
              trackClient(AnalyticsEvent.CtaStartForFree, { location: "header" })
            }
          >
            Get Started
          </Button>
        </Link>
      </nav>
    </header>
  );
}
