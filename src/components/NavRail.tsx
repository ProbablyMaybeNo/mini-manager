"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type NavItem = {
  href: Route;
  key: string;
  label: string;
};

const PRIMARY: readonly NavItem[] = [
  { href: "/projects", key: "P", label: "Projects" },
  { href: "/library",  key: "L", label: "Library" },
  { href: "/recipes",  key: "R", label: "Recipes" },
  { href: "/tools",    key: "T", label: "Tools" },
  { href: "/wishlist", key: "W", label: "Wishlist" },
] as const;

const SECONDARY: readonly NavItem[] = [
  { href: "/user", key: "U", label: "User" },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/projects") {
    return pathname === "/" || pathname.startsWith("/projects");
  }
  return pathname.startsWith(href);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={clsx(
        "group flex items-center gap-3 px-3 py-2 rounded-sm text-sm tap-target",
        "border-l-2 border-transparent transition-colors",
        active
          ? "border-l-[var(--color-green)] bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={clsx(
          "inline-flex w-6 justify-center font-mono text-xs",
          active ? "glow-green" : "text-[var(--color-fg-muted)]"
        )}
        aria-hidden
      >
        [{item.key}]
      </span>
      <span
        className={clsx(
          "font-mono",
          active ? "glow-green" : "text-[var(--color-fg)]"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function NavRail() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex md:flex-col w-[200px] shrink-0 border-r border-[var(--color-border)] py-4 px-2 gap-1"
      aria-label="Primary"
    >
      <div className="px-3 pb-4">
        <Link href="/projects" className="font-mono text-sm glow-green tracking-wide">
          MINI MANAGER
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5">
        {PRIMARY.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="my-3 mx-3 border-t border-[var(--color-border)]" />

      <nav className="flex flex-col gap-0.5">
        {SECONDARY.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>
    </aside>
  );
}
