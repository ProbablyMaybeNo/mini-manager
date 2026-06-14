"use client";

import { useState } from "react";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { SlideOutPanel } from "@/components/kit";
import { FOOTER_NAV, MAIN_NAV } from "./nav";

/** Mobile top bar: logo + menu button that opens the nav in the shared slide-out. */
export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="flex items-center justify-between border-b border-cyan/40 bg-bg-raised/40 px-4 py-2 md:hidden">
        <Logo size={44} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="border border-cyan/60 px-3 py-1.5 font-osd text-xs uppercase tracking-[0.18em] text-cyan hover:bg-cyan/10"
        >
          ☰ Menu
        </button>
      </header>

      <SlideOutPanel
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        width="max-w-[260px]"
        title="Navigation"
      >
        <NavLinks items={MAIN_NAV} onNavigate={() => setOpen(false)} />
        <div className="mt-4 border-t border-cyan/30 pt-3">
          <NavLinks items={FOOTER_NAV} onNavigate={() => setOpen(false)} />
        </div>
      </SlideOutPanel>
    </>
  );
}
