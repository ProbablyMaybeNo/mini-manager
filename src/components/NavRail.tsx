"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Folder,
  Palette,
  FlaskConical,
  Wrench,
  Heart,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: Route;
  Icon: LucideIcon;
  label: string;
};

const PRIMARY: readonly NavItem[] = [
  { href: "/projects", Icon: Folder,       label: "Projects" },
  { href: "/library",  Icon: Palette,      label: "Library"  },
  { href: "/recipes",  Icon: FlaskConical, label: "Recipes"  },
  { href: "/tools",    Icon: Wrench,       label: "Tools"    },
  { href: "/wishlist", Icon: Heart,        label: "Wishlist" },
] as const;

const SECONDARY: readonly NavItem[] = [
  { href: "/user", Icon: UserIcon, label: "User" },
] as const;

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/projects") {
    return pathname === "/" || pathname.startsWith("/projects");
  }
  return pathname.startsWith(href);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      className={clsx(
        "group flex items-center gap-3 px-3 py-2 rounded-sm text-sm tap-target",
        "border-l-2 border-transparent transition-colors duration-150",
        active
          ? "border-l-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
          : "hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={clsx(
          "inline-flex w-6 justify-center",
          active ? "text-[var(--color-accent)]" : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]"
        )}
        aria-hidden
      >
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span
        className={clsx(
          "font-mono",
          active ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

export interface NavRailUser {
  name: string | null;
  email: string | null;
}

export interface NavRailProps {
  user?: NavRailUser | null;
  appVersion?: string;
}

function userInitial(user: NavRailUser | null | undefined): string {
  if (!user) return "?";
  const source = user.name ?? user.email ?? "?";
  const ch = source.trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function userLabel(user: NavRailUser | null | undefined): string {
  if (!user) return "Guest";
  if (user.name && user.name.trim()) return user.name;
  if (user.email) {
    const at = user.email.indexOf("@");
    return at > 0 ? user.email.slice(0, at) : user.email;
  }
  return "User";
}

export function NavRail({ user, appVersion }: NavRailProps = {}) {
  const pathname = usePathname();
  const initial = userInitial(user);
  const label = userLabel(user);

  return (
    <aside
      className="hidden md:flex md:flex-col w-[200px] shrink-0 border-r border-[var(--color-border)] py-4 px-2 gap-1"
      aria-label="Primary"
    >
      <div className="px-3 pb-4">
        <Link href="/projects" className="font-mono text-sm glow-cyan tracking-wide">
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

      <div className="mt-auto pt-3 px-2 border-t border-[var(--color-border)] flex flex-col gap-2">
        {appVersion ? (
          <span className="font-mono text-2xs text-[var(--color-fg-subtle)] tracking-wider uppercase px-1">
            v{appVersion} <span className="text-[var(--color-fg-muted)]">// STABLE</span>
          </span>
        ) : null}
        <Link
          href="/user"
          className="group flex items-center gap-2 px-1.5 py-1 rounded-sm hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]"
          aria-label={`Signed in as ${label}`}
        >
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-strong)] font-mono text-sm text-[var(--color-fg-muted)] group-hover:border-[var(--color-accent)] group-hover:text-[var(--color-accent)]"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xs font-mono text-[var(--color-fg)] truncate">
              {label}
            </span>
            <span className="block text-2xs font-mono text-[var(--color-fg-subtle)] inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[var(--color-green)]"
                style={{
                  boxShadow:
                    "0 0 6px color-mix(in srgb, var(--color-green) 60%, transparent)",
                }}
              />
              ONLINE
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
