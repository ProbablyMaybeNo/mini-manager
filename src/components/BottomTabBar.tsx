"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type TabItem = {
  href: Route;
  key: string;
  label: string;
};

const TABS: readonly TabItem[] = [
  { href: "/projects", key: "P", label: "Projects" },
  { href: "/library",  key: "L", label: "Library" },
  { href: "/recipes",  key: "R", label: "Recipes" },
  { href: "/tools",    key: "T", label: "Tools" },
  { href: "/wishlist", key: "W", label: "Wishlist" },
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
        "flex flex-row border-t border-[var(--color-border)]",
        "bg-[var(--color-bg)]"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      aria-label="Primary"
    >
      {TABS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            className={clsx(
              "flex flex-col items-center justify-center gap-0.5",
              "flex-1 min-h-[56px] px-1 py-2",
              "border-t-2 transition-colors",
              active
                ? "border-t-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
                : "border-t-transparent"
            )}
          >
            <span
              className={clsx(
                "font-mono text-xs",
                active ? "glow-cyan" : "text-[var(--color-fg-muted)]"
              )}
              aria-hidden
            >
              [{item.key}]
            </span>
            <span
              className={clsx(
                "font-mono text-2xs",
                active ? "glow-cyan" : "text-[var(--color-fg-muted)]"
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
