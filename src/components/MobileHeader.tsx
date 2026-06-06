"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { OPEN_SEARCH_EVENT } from "@/components/search/GlobalSearch";
import { Logo } from "@/components/ui/Logo";

export interface MobileHeaderUser {
  name: string | null;
  email: string | null;
}

function isUserActive(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/user");
}

function userInitial(user: MobileHeaderUser | null | undefined): string {
  if (!user) return "U";
  const source = user.name ?? user.email ?? "U";
  const ch = source.trim().charAt(0);
  return ch ? ch.toUpperCase() : "U";
}

export function MobileHeader({
  user,
}: { user?: MobileHeaderUser | null } = {}) {
  const pathname = usePathname();
  const userActive = isUserActive(pathname);
  const initial = userInitial(user);

  return (
    <header
      className={clsx(
        "md:hidden fixed top-0 left-0 right-0 z-40",
        "flex items-center justify-between",
        "h-12 px-3 gap-2",
        // Phosphor bottom edge — cyan 22% into --color-border, matching
        // the StatusBar + NavRail so the chrome reads as one terminal frame.
        "border-b border-[color-mix(in_srgb,var(--color-cyan)_22%,var(--color-border))]",
        "bg-[var(--color-bg-elevated)]"
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      aria-label="Mobile header"
    >
      {/* UI-CHROME — the text wordmark is replaced by the sign-in brand
          logo (the engraved CRT lockup), sized to fit the 48px header.
          The Link carries the accessible name. */}
      <Link
        href="/projects"
        aria-label="Mini Manager"
        className="inline-flex items-center rounded-sm"
      >
        <Logo width={32} decorative />
      </Link>

      <span className="inline-flex items-center gap-2">
        {/* M2 — first-class mobile search trigger. Opens the existing
            GlobalSearch overlay (keyboard-only on desktop) via a window
            event so recall-from-anywhere works by tap on a phone. The
            near-zero-value "● ON" status pill was removed to reclaim the
            scarce header width (content over chrome). */}
        <button
          type="button"
          aria-label="Search"
          onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
          className={clsx(
            "tap-target inline-flex items-center justify-center",
            "h-8 w-8 rounded-sm border font-mono",
            "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]",
            "hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]"
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
          </svg>
        </button>
        <Link
          href="/user"
          aria-current={userActive ? "page" : undefined}
          aria-label="User"
          className={clsx(
            "tap-target inline-flex items-center justify-center",
            "h-8 w-8 rounded-full border font-mono text-xs transition-colors",
            userActive
              ? "border-[var(--color-cyan)] text-[var(--color-cyan)] glow-cyan"
              : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
          )}
        >
          {initial}
        </Link>
      </span>
    </header>
  );
}
