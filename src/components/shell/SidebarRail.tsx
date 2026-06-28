"use client";

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
      {/* Logo block — cyan accent square + product wordmark, links home. */}
      <Link
        href="/dashboard"
        aria-label="The Mini Mainframe"
        className="mb-8 flex items-center gap-2.5 px-6"
      >
        <span
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-[4px] bg-cyan shadow-[0_0_10px_0_rgba(0,245,255,0.4)]"
        />
        <span className="font-mono text-[16px] font-extrabold tracking-tight text-fg-bright">
          MINI&nbsp;MAINFRAME
        </span>
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
