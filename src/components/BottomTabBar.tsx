"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Folder,
  Target,
  Palette,
  FlaskConical,
  Wrench,
  Boxes,
  type LucideIcon,
} from "lucide-react";

type TabItem = {
  href: Route;
  Icon: LucideIcon;
  label: string;
};

// UX-014 — FOCUS is a core "sit down and paint" flow and a top-level
// desktop nav item, but the mobile tab bar shipped with only 5 of the 6
// sections reachable. Add FOCUS (/planner, Target icon) as the 6th tab so
// every primary section is one tap away on phones, matching the desktop
// NavRail order (Dashboard · Focus · Library · Recipes · Tools · Collections).
const TABS: readonly TabItem[] = [
  { href: "/projects",    Icon: Folder,       label: "Dashboard" },
  { href: "/planner",     Icon: Target,       label: "Focus"     },
  { href: "/library",     Icon: Palette,      label: "Library"   },
  { href: "/recipes",     Icon: FlaskConical, label: "Recipes"   },
  { href: "/tools",       Icon: Wrench,       label: "Tools"     },
  { href: "/collections", Icon: Boxes,        label: "Collections" },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/projects") {
    return pathname === "/" || pathname.startsWith("/projects");
  }
  return pathname.startsWith(href);
}

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className={clsx(
        "md:hidden fixed bottom-0 left-0 right-0 z-40",
        // Phosphor top edge — cyan 22% into --color-border, matching the
        // StatusBar + NavRail + MobileHeader so the chrome reads as one
        // continuous terminal frame.
        "flex flex-row border-t border-[color-mix(in_srgb,var(--color-cyan)_22%,var(--color-border))]",
        "bg-[var(--color-bg-elevated)]"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      aria-label="Primary"
    >
      {TABS.map((item) => {
        const active = isActive(pathname, item.href);
        const { Icon } = item;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            className={clsx(
              // Terminal tab: cyan top-edge marker + faint cyan wash on the
              // active tab; the 2px transparent top border on the resting
              // state reserves the marker's space so activation doesn't
              // shift the row. 56px row keeps the ≥44px mobile tap floor.
              // 6 tabs share the row now (UX-014), so the per-tab padding
              // tightens to px-0.5 and the label truncates rather than
              // wraps — keeps "DASHBOARD"/"WISHLIST" on one line at 360px.
              "group flex flex-col items-center justify-center gap-1",
              "flex-1 min-w-0 min-h-[56px] px-0.5 py-2",
              "border-t-2 transition-colors duration-150",
              active
                ? "border-t-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
                : "border-t-transparent"
            )}
          >
            <Icon
              size={22}
              strokeWidth={1.75}
              className={clsx(
                active
                  ? "text-[var(--color-cyan)] glow-cyan"
                  : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-cyan)]"
              )}
              aria-hidden
            />
            <span
              className={clsx(
                "font-mono text-2xs tracking-wide uppercase max-w-full truncate",
                active
                  ? "text-[var(--color-cyan)] glow-cyan"
                  : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-cyan)]"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
