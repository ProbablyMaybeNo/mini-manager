"use client";

import Image from "next/image";
import Link from "next/link";
import { TourReplayButton } from "@/components/tour";
import { ReportIssueButton } from "@/components/feedback/ReportIssueButton";
import { NavLinks } from "./NavLinks";
import { FOOTER_NAV, MAIN_NAV } from "./nav";

/**
 * Fixed desktop left rail (HEX.CODE 4:4 / navigation 1:191): 220px, surface
 * fill, logo block top (cyan square + wordmark), main nav, then the pinned
 * footer (Settings / Account / Tutorial / Feedback) below a divider.
 */
export function SidebarRail() {
  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-[220px] shrink-0 flex-col border-r border-border bg-surface py-8 min-[840px]:flex"
    >
      {/* Logo block — the Mini Mainframe CRT mark, links home. The art is bright
          cyan on black; `lighten` drops its black backdrop into the rail so it
          reads as a glowing mark, not a boxed image. */}
      <Link
        href="/dashboard"
        aria-label="The Mini Mainframe"
        className="mb-8 flex justify-center px-5"
      >
        <Image
          src="/brand/mini-mainframe-logo-poster.jpg"
          alt="The Mini Mainframe"
          width={150}
          height={150}
          priority
          className="h-auto w-[150px] mix-blend-lighten"
        />
      </Link>

      <NavLinks items={MAIN_NAV} />

      <div className="mt-auto flex flex-col border-t border-border pt-2">
        <NavLinks items={FOOTER_NAV} />
        {/* Re-trigger the first-run walkthrough on demand, pinned below ACCOUNT. */}
        <TourReplayButton />
        {/* Report an Issue — files a card in the Notion bug tracker. */}
        <ReportIssueButton />
      </div>
    </nav>
  );
}
