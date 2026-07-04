"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlideOutPanel } from "@/components/kit";
import { TourReplayButton } from "@/components/tour";
import { ReportIssueButton } from "@/components/feedback/ReportIssueButton";
import { cn } from "@/lib/cn";
import { NavLinks } from "./NavLinks";
import {
  activeNavKey,
  BOTTOM_NAV_MORE,
  BOTTOM_NAV_PRIMARY,
  type NavItem,
} from "./nav";

/** Compact pixel glyphs for the four primaries — terminal-flavoured, not a
 *  full icon set. Bottom-nav tabs pair a glyph with the label. */
const GLYPH: Record<string, string> = {
  dashboard: "▣",
  library: "◰",
  collection: "◫",
  tools: "⚙",
};

/**
 * Persistent phone bottom navigation (MUX-001). Shown only below 840px and,
 * with the rail taking over at ≥840px, it owns mobile primary nav. Four
 * labelled tabs (Dashboard · Library · Collection · Tools) plus a "More" entry
 * that opens the rest (Focus · Recipes · Account · Tutorial) in the shared
 * slide-out.
 *
 * Tour anchors: the four primaries carry their real `data-tour` anchors. The
 * overflow items (nav-recipe, nav-focus) live in the More sheet, which unmounts
 * when closed — so their anchors are also mirrored as zero-footprint spans
 * pinned over the More button. That keeps every walked tour step resolvable
 * (a recipe/focus step spotlights "More", where the painter actually finds it)
 * instead of dead-centring as a modal.
 */
export function BottomNav() {
  const pathname = usePathname();
  const active = activeNavKey(pathname);
  const [moreOpen, setMoreOpen] = useState(false);

  // Whether the active route lives behind "More" — highlights the More tab.
  const moreActive = BOTTOM_NAV_MORE.some((n) => n.key === active);

  return (
    <>
      <nav
        aria-label="Primary"
        // Persistent bottom bar < 840px; the rail replaces it at ≥840px.
        // pb safe-area inset keeps the tabs clear of the home indicator; the
        // l/r safe-area insets keep the first/last labels off the screen edge
        // so "More" no longer clips on notched phones (UX-009).
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-cyan/40 bg-bg pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] min-[840px]:hidden"
      >
        {BOTTOM_NAV_PRIMARY.map((item) => (
          <BottomTab key={item.key} item={item} active={item.key === active} />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive ? "page" : undefined}
          className={cn(
            "relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 px-1 py-1.5 font-h1 text-[0.6rem] uppercase tracking-[0.08em] transition-colors",
            moreActive
              ? "border-cyan bg-cyan/10 text-cyan-lite text-glow-cyan"
              : "border-transparent text-fg-dim hover:text-cyan-lite",
          )}
        >
          <span aria-hidden className="text-base leading-none">
            ⋯
          </span>
          <span className="w-full truncate text-center leading-none">More</span>

          {/* Resolvable tour anchors for the overflow items, pinned over the
              More tab so a recipe/focus tour step spotlights this button. */}
          {BOTTOM_NAV_MORE.filter((n) => n.tour).map((n) => (
            <span
              key={n.key}
              data-tour={n.tour}
              aria-hidden
              className="pointer-events-none absolute inset-0"
            />
          ))}
        </button>
      </nav>

      <SlideOutPanel
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        side="left"
        width="max-w-[280px]"
        title="More"
      >
        <NavLinks
          items={BOTTOM_NAV_MORE}
          onNavigate={() => setMoreOpen(false)}
        />
        <div className="mt-4 border-t border-cyan/30 pt-3">
          {/* Replay carries data-tour="nav-tutorial"; reachable here on phones. */}
          <TourReplayButton onNavigate={() => setMoreOpen(false)} />
          <ReportIssueButton onNavigate={() => setMoreOpen(false)} />
        </div>
      </SlideOutPanel>
    </>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.path}
      data-tour={item.tour}
      aria-current={active ? "page" : undefined}
      className={cn(
        // min-w-0 + a truncating full-width label keeps each of the 5 cells
        // within its grid column so no label (incl. the last) clips (UX-009).
        "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 px-1 py-1.5 font-h1 text-[0.6rem] uppercase tracking-[0.08em] transition-colors",
        active
          ? "border-cyan bg-cyan/10 text-cyan-lite text-glow-cyan"
          : "border-transparent text-fg-dim hover:text-cyan-lite",
      )}
    >
      <span aria-hidden className="text-base leading-none">
        {GLYPH[item.key] ?? "•"}
      </span>
      <span className="w-full truncate text-center leading-none">{item.label}</span>
    </Link>
  );
}
