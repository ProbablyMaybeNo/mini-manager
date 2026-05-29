"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

function isUserActive(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/user");
}

export function MobileHeader() {
  const pathname = usePathname();
  const userActive = isUserActive(pathname);

  return (
    <header
      className={clsx(
        "md:hidden fixed top-0 left-0 right-0 z-40",
        "flex items-center justify-between",
        "h-12 px-3",
        "border-b border-[var(--color-border)]",
        "bg-[var(--color-bg)]"
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
      aria-label="Mobile header"
    >
      <Link
        href="/projects"
        className="font-mono text-sm glow-green tracking-wide"
      >
        MINI MANAGER
      </Link>
      <Link
        href="/user"
        aria-current={userActive ? "page" : undefined}
        aria-label="User"
        className={clsx(
          "tap-target inline-flex items-center justify-center",
          "font-mono text-xs",
          userActive ? "glow-green" : "text-[var(--color-fg-muted)]"
        )}
      >
        [U]
      </Link>
    </header>
  );
}
