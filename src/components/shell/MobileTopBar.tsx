"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { SlideOutPanel } from "@/components/kit";
import { TourReplayButton } from "@/components/tour";
import { ReportIssueButton } from "@/components/feedback/ReportIssueButton";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { ALL_NAV } from "./nav";

/**
 * Mobile top header (< 840px): logo left, hamburger right.
 *
 * Replaces the old five-tab bottom bar (Ross, 2026-07-27). The bar could only
 * fit four of the seven pages, so half the app lived behind a "More" tab while
 * the bar itself permanently ate ~52px of a phone screen. A hamburger costs
 * nothing until it's opened and lists EVERY page in one flat menu — more room
 * for content, no second-class routes.
 *
 * Tour anchors: nav items carry their `data-tour` anchors inside the sheet,
 * which unmounts when closed. Each anchor is therefore mirrored as a
 * zero-footprint span pinned over the burger, so a tour step for any page
 * spotlights the menu — where the painter actually finds it.
 */
export function MobileTopBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between border-b border-cyan/40 bg-bg-raised/40 px-4 py-2 min-[840px]:hidden">
        <Logo size={44} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="relative flex h-11 w-11 items-center justify-center rounded-[6px] border border-cyan/40 text-cyan-lite transition-colors hover:bg-cyan/10 focus:outline-none focus-visible:bg-cyan/10"
        >
          <Menu size={22} aria-hidden />
          {ALL_NAV.filter((n) => n.tour).map((n) => (
            <span
              key={n.key}
              data-tour={n.tour}
              aria-hidden
              className="pointer-events-none absolute inset-0"
            />
          ))}
        </button>
      </header>

      <SlideOutPanel
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        width="max-w-[280px]"
        title="Menu"
      >
        <NavLinks items={ALL_NAV} onNavigate={() => setOpen(false)} />
        <div className="mt-4 border-t border-cyan/30 pt-3">
          <TourReplayButton onNavigate={() => setOpen(false)} />
          <ReportIssueButton onNavigate={() => setOpen(false)} />
        </div>
      </SlideOutPanel>
    </>
  );
}
