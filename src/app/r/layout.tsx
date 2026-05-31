import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Public recipe layout — no NavRail (NavRail is auth-only). Minimal
 * wordmark + sign-in button so a friend opening a slug URL can convert
 * into a Mini Manager account with one tap.
 *
 * Mounts ABOVE the root layout's NavRail wrapper — since `/r/*` is
 * matcher-excluded in `proxy.ts`, no auth lookup runs.
 */
export default function PublicRecipeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-wide text-[var(--color-fg)] hover:text-[var(--color-accent)]"
          >
            <span aria-hidden className="text-[var(--color-cyan)]">▍</span>{" "}
            Mini Manager
          </Link>
          {/* tap-target enforces 44px on mobile / 32px on desktop per
              WCAG 2.2 §2.5.8. Previously rendered at ~31px tall —
              below the desktop minimum and well below mobile. UX-V3-006. */}
          <Link
            href="/sign-in"
            className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] tap-target inline-flex items-center justify-center"
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
