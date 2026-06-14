import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { FOOTER_NAV, MAIN_NAV } from "./nav";

/** Fixed desktop left rail: logo top, main nav, footer nav pinned bottom. */
export function SidebarRail() {
  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-[204px] shrink-0 flex-col border-r border-cyan/40 bg-bg-raised/40 py-4 md:flex"
    >
      <div className="px-4 pb-6">
        <Logo size={72} />
      </div>
      <NavLinks items={MAIN_NAV} />
      <div className="mt-auto border-t border-cyan/30 pt-3">
        <NavLinks items={FOOTER_NAV} />
      </div>
    </nav>
  );
}
