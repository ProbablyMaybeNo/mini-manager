import { Logo } from "./Logo";

/**
 * Mobile top header (< 840px): a slim logo bar. Primary navigation now lives in
 * the persistent {@link BottomNav} (MUX-001) — its thumb-zone tabs plus the
 * "More" sheet replace the old hamburger menu, so this bar is purely a brand
 * anchor at the top of the phone/tablet viewport. The rail takes over ≥840px.
 */
export function MobileTopBar() {
  return (
    <header className="flex items-center justify-between border-b border-cyan/40 bg-bg-raised/40 px-4 py-2 min-[840px]:hidden">
      <Logo size={44} />
    </header>
  );
}
