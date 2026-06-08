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
  Search,
  User as UserIcon,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useNavRailCollapsed } from "@/lib/hooks/useNavRailCollapsed";
import { OPEN_SEARCH_EVENT } from "@/components/search/GlobalSearch";
import { Logo } from "@/components/ui/Logo";

type NavItem = {
  href: Route;
  Icon: LucideIcon;
  label: string;
};

const PRIMARY: readonly NavItem[] = [
  // /projects is the DASHBOARD (KPI strip + project table + widgets);
  // nav label matches the page title.
  { href: "/projects", Icon: Folder, label: "Dashboard" },
  // FOCUS-DASH — /planner is now the FOCUS painting screen (bench recipe
  // row + compact project panel + stopwatch + inspo). Path kept to limit
  // typed-route churn; label + H1 retitled FOCUS. Target icon = the
  // single-project painting focus.
  { href: "/planner", Icon: Target, label: "Focus" },
  { href: "/library",  Icon: Palette,      label: "Library"  },
  { href: "/recipes",  Icon: FlaskConical, label: "Recipes"  },
  { href: "/tools",    Icon: Wrench,       label: "Tools"    },
  { href: "/collections", Icon: Boxes,    label: "Collections" },
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

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={clsx(
        // Terminal nav row: mono label, sharp corners, a cyan left-edge
        // marker on the active route. The 2px transparent left border on
        // the resting state reserves the marker's space so the active
        // cyan edge doesn't shift the row.
        "group relative flex items-center gap-3 rounded-none text-sm tap-target",
        "border-l-2 border-transparent transition-colors duration-150",
        "uppercase tracking-[0.08em]",
        collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
        active
          ? "border-l-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
          : "hover:border-l-[color-mix(in_srgb,var(--color-cyan)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-cyan)_6%,transparent)]"
      )}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <span
        className={clsx(
          "inline-flex w-6 justify-center",
          active
            ? "text-[var(--color-cyan)] glow-cyan"
            : "text-[var(--color-fg-muted)] group-hover:text-[var(--color-cyan)]"
        )}
        aria-hidden
      >
        <Icon size={20} strokeWidth={1.75} />
      </span>
      {collapsed ? null : (
        <span
          className={clsx(
            "font-mono inline-flex items-center gap-1.5",
            active
              ? "text-[var(--color-cyan)] glow-cyan"
              : "text-[var(--color-fg)] group-hover:text-[var(--color-cyan)]"
          )}
        >
          {/* Tech-label marker — a tiny ▸ that lights cyan on the active
              row, the diegetic "selected channel" cue from the spec. */}
          <span
            aria-hidden
            className={clsx(
              "font-mono text-2xs leading-none transition-opacity",
              active
                ? "opacity-100 text-[var(--color-cyan)]"
                : "opacity-0 group-hover:opacity-60"
            )}
          >
            ▸
          </span>
          {item.label}
        </span>
      )}
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
  const [collapsed, setCollapsed] = useNavRailCollapsed();

  return (
    <aside
      className={clsx(
        // Near-black command-column with a 1px phosphor right-edge — the
        // cyan-tinted border matches the StatusBar foundation
        // (color-mix cyan 22% into the neutral border) so the shell reads
        // as one continuous terminal frame.
        "hidden md:flex md:flex-col shrink-0 py-4 px-2 gap-1",
        "bg-[var(--color-bg-elevated)]",
        "border-r border-[color-mix(in_srgb,var(--color-cyan)_22%,var(--color-border))]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px]" : "w-[200px]",
      )}
      aria-label="Primary"
    >
      <div
        className={clsx(
          "flex items-center pb-4",
          collapsed ? "justify-center" : "justify-between px-3",
        )}
      >
        {collapsed ? null : (
          <Link
            href="/projects"
            aria-label="Mini Manager"
            className="inline-flex items-center rounded-sm"
          >
            {/* UI-CHROME — the text wordmark is replaced by the sign-in
                brand logo (the engraved CRT lockup). The Link carries the
                accessible name so the decorative image needs none.
                REDESIGN-CLEANUP (fix 4) — Ross: the brand logo was too small
                to read ("mini-manager" illegible at 36px). Bumped to 48px so
                the wordmark inside the lockup is legible; still fits the
                200px rail header beside the 32px collapse toggle, and the
                collapsed rail renders no logo so nothing clips there. */}
            <Logo width={48} decorative />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex items-center justify-center h-8 w-8 rounded-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen size={16} strokeWidth={1.75} />
          ) : (
            <PanelLeftClose size={16} strokeWidth={1.75} />
          )}
        </button>
      </div>

      {/* D4 — visible command-palette trigger. Opens the same overlay as
          Cmd/Ctrl+K (the universal binding); the inline ⌘K kbd advertises
          the shortcut so the power layer is discoverable, not hidden. */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
        title={collapsed ? "Search · ⌘K" : undefined}
        aria-label="Open command palette"
        aria-keyshortcuts="Meta+K Control+K"
        className={clsx(
          "group flex items-center gap-3 rounded-sm text-sm tap-target mb-1",
          "border border-[var(--color-border-strong)] transition-colors duration-150",
          "text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]",
          // M7 — visible focus ring (≥2px, 3:1) on the new control.
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]",
          collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
        )}
      >
        <span className="inline-flex w-6 justify-center" aria-hidden>
          <Search size={18} strokeWidth={1.75} />
        </span>
        {collapsed ? null : (
          <>
            <span className="font-mono">Search</span>
            <kbd
              aria-hidden
              className="ml-auto font-mono text-2xs text-[var(--color-fg-subtle)] px-1 py-0.5 frame"
            >
              ⌘K
            </kbd>
          </>
        )}
      </button>

      <nav className="flex flex-col gap-0.5">
        {PRIMARY.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
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
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div
        className={clsx(
          "mt-auto pt-3 border-t border-[var(--color-border)] flex flex-col gap-2",
          collapsed ? "px-1 items-center" : "px-2",
        )}
      >
        {appVersion && !collapsed ? (
          <span className="font-mono text-2xs text-[var(--color-fg-subtle)] tracking-wider uppercase px-1">
            v{appVersion} <span className="text-[var(--color-fg-muted)]">// STABLE</span>
          </span>
        ) : null}
        <Link
          href="/user"
          className={clsx(
            "group flex items-center rounded-sm hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)]",
            collapsed ? "justify-center p-1" : "gap-2 px-1.5 py-1",
          )}
          aria-label={`Signed in as ${label}`}
          title={collapsed ? `Signed in as ${label} · ONLINE` : undefined}
        >
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-strong)] font-mono text-sm text-[var(--color-fg-muted)] group-hover:border-[var(--color-accent)] group-hover:text-[var(--color-accent)]"
          >
            {initial}
          </span>
          {collapsed ? null : (
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
          )}
        </Link>
      </div>
    </aside>
  );
}
