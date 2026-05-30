"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

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
        "border-b border-[var(--color-border)]",
        "bg-[var(--color-bg)]"
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      aria-label="Mobile header"
    >
      <Link
        href="/projects"
        className="font-mono text-sm glow-cyan tracking-wide"
      >
        MINI MANAGER
      </Link>

      <span className="inline-flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]"
          aria-label="Online"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[var(--color-green)]"
            style={{
              boxShadow:
                "0 0 6px color-mix(in srgb, var(--color-green) 60%, transparent)",
            }}
          />
          ON
        </span>
        <Link
          href="/user"
          aria-current={userActive ? "page" : undefined}
          aria-label="User"
          className={clsx(
            "tap-target inline-flex items-center justify-center",
            "h-8 w-8 rounded-full border font-mono text-xs",
            userActive
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]"
          )}
        >
          {initial}
        </Link>
      </span>
    </header>
  );
}
