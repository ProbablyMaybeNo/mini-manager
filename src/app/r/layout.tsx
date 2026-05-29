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
            className="font-mono text-sm font-semibold tracking-wide text-[var(--color-fg)] hover:text-[var(--color-green)]"
          >
            <span aria-hidden className="text-[var(--color-green)]">▍</span>{" "}
            Mini Manager
          </Link>
          <Link
            href="/sign-in"
            className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 border border-[var(--color-border-strong)] hover:border-[var(--color-green)] hover:text-[var(--color-green)]"
          >
            Sign in
          </Link>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
