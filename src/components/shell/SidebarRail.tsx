"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  isNavActive,
  type NavItem,
} from "./nav";

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        // Terminal nav row: mono caps, sharp corners, min 44px target.
        "flex min-h-[44px] items-center px-3 font-mono text-xs uppercase tracking-[0.1em]",
        "border-l-2 transition-colors duration-150 motion-reduce:transition-none",
        active
          ? // Active = cyan + glow (REBUILD_SPEC §2).
            "border-l-[var(--color-cyan)] text-[var(--color-cyan)] glow-text-strong bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
          : "border-l-transparent text-[var(--color-fg)] hover:text-[var(--color-cyan)] hover:border-l-[color-mix(in_srgb,var(--color-cyan)_45%,transparent)]",
      )}
    >
      {item.label}
    </Link>
  );
}

/**
 * SidebarRail — the desktop app shell rail (FIGMA-REBUILD, REBUILD_SPEC §2,
 * matching docs/redesign-refs/Dashboard.png):
 *
 *  - ~130px, full viewport height, 1px CYAN right border
 *  - pixel CRT logo (~88px, image-rendering: pixelated) at the top,
 *    linking home (/projects)
 *  - DASHBOARD · LIBRARY · RECIPE · TOOLS · COLLECTION
 *  - divider, then SETTINGS · ACCOUNT pinned to the lower group
 *  - active link = cyan + glow; inactive = white, cyan on hover
 *
 * Hidden below md — MobileTopBar carries the shell there.
 */
export function SidebarRail() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary"
      className="sticky top-0 hidden h-screen w-[130px] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-cyan)] bg-[var(--color-bg)] py-4 md:flex"
    >
      <Link
        href="/projects"
        aria-label="Mini Manager — Dashboard"
        className="mx-auto mb-4 block"
      >
        <Image
          src="/brand/logo-pixel.png"
          alt=""
          aria-hidden
          width={88}
          height={88}
          priority
          className="[image-rendering:pixelated]"
        />
      </Link>

      <nav className="flex flex-col" aria-label="Main">
        {PRIMARY_NAV.map((item) => (
          <RailLink
            key={item.label}
            item={item}
            active={isNavActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="mt-auto">
        <div
          className="mx-3 mb-2 border-t border-[color-mix(in_srgb,var(--color-cyan)_35%,transparent)]"
          aria-hidden
        />
        <nav className="flex flex-col" aria-label="Account">
          {SECONDARY_NAV.map((item) => (
            <RailLink
              key={item.label}
              item={item}
              active={isNavActive(pathname, item.href)}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
