import { TourReplayButton } from "@/components/tour";
import { ReportIssueButton } from "@/components/feedback/ReportIssueButton";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { FOOTER_NAV, MAIN_NAV } from "./nav";

/** Fixed desktop left rail: logo top, main nav, footer nav pinned bottom. */
export function SidebarRail() {
  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-[240px] shrink-0 flex-col border-r border-cyan/40 bg-bg py-4 min-[840px]:flex"
    >
      <div className="flex justify-center px-4 pb-6">
        <Logo size={140} />
      </div>
      <NavLinks items={MAIN_NAV} />
      <div className="mt-auto border-t border-cyan/30 pt-3">
        <NavLinks items={FOOTER_NAV} />
        {/* Re-trigger the first-run walkthrough on demand, pinned below ACCOUNT. */}
        <TourReplayButton />
        {/* Report an Issue — files a card in the Notion bug tracker. */}
        <ReportIssueButton />
      </div>
    </nav>
  );
}
