"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Menu } from "lucide-react";
import { SlideOutPanel } from "@/components/ui/SlideOutPanel";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  isNavActive,
  type NavItem,
} from "./nav";

function SheetLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-h-[44px] items-center border-l-2 px-3 font-mono text-sm uppercase tracking-[0.1em]",
        active
          ? "border-l-[var(--color-cyan)] text-[var(--color-cyan)] glow-text-strong bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
          : "border-l-transparent text-[var(--color-fg)]",
      )}
    >
      {item.label}
    </Link>
  );
}

/**
 * MobileTopBar — the mobile collapse of the sidebar rail (REBUILD_SPEC §2):
 * a fixed 48px top bar (pixel logo + hamburger, both ≥44px targets) opening
 * a full-width focus-trapped nav sheet (SlideOutPanel, Esc closes).
 * Hidden at md+ where SidebarRail takes over.
 */
export function MobileTopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the sheet whenever the route actually changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between border-b border-[var(--color-cyan)] bg-[var(--color-bg)] px-2 pt-[env(safe-area-inset-top,0px)] md:hidden">
      <Link
        href="/projects"
        aria-label="Mini Manager — Dashboard"
        className="tap-target inline-flex items-center gap-2 px-1"
      >
        <Image
          src="/brand/logo-pixel.png"
          alt=""
          aria-hidden
          width={32}
          height={32}
          priority
          className="[image-rendering:pixelated]"
        />
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--color-cyan)]">
          Mini Manager
        </span>
      </Link>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="tap-target inline-flex items-center justify-center text-[var(--color-fg)] hover:text-[var(--color-cyan)]"
      >
        <Menu size={22} strokeWidth={1.75} aria-hidden />
      </button>

      <SlideOutPanel
        open={open}
        onClose={() => setOpen(false)}
        title="Navigation"
        breadcrumb={"SYS > NAV"}
        side="left"
        width={300}
      >
        <nav aria-label="Main" className="-mx-4 flex flex-col">
          {PRIMARY_NAV.map((item) => (
            <SheetLink
              key={item.label}
              item={item}
              active={isNavActive(pathname, item.href)}
              onNavigate={() => setOpen(false)}
            />
          ))}
          <div
            className="mx-3 my-2 border-t border-[color-mix(in_srgb,var(--color-cyan)_35%,transparent)]"
            aria-hidden
          />
          {SECONDARY_NAV.map((item) => (
            <SheetLink
              key={item.label}
              item={item}
              active={isNavActive(pathname, item.href)}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
      </SlideOutPanel>
    </header>
  );
}
