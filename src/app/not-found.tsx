import Link from "next/link";

/**
 * UX-001 — themed root not-found boundary.
 *
 * Next.js's default not-found boundary forces a WHITE body background with
 * near-white text (~1.04:1 contrast — text invisible) and flashes a
 * full-screen white panel inside our pure-black terminal app, breaking the
 * aesthetic and failing WCAG 2.2 §1.4.3 catastrophically.
 *
 * This component replaces it inside the terminal shell: the layout's
 * `#0A0A0A` (--color-bg-elevated) ground, a cyan "404" lockup, a phosphor
 * body line, and a `RETURN TO DASHBOARD` link as the single way back. It
 * renders INSIDE the root layout (NavRail + chrome stay), so an unknown
 * authenticated route reads as "page not found in the OS", not a white
 * crash screen.
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md text-center space-y-4">
        <p className="font-mono text-2xs uppercase tracking-[0.25em] text-[var(--color-red)]">
          SYS ▸ ERROR / 404
        </p>
        <p
          className="title-display text-[var(--color-cyan)] text-4xl md:text-5xl glow-cyan"
          aria-hidden
        >
          404
        </p>
        <h1 className="sr-only">Page not found</h1>
        <p className="font-mono text-sm text-[var(--color-fg-muted)] leading-relaxed">
          No signal at this address. The page was moved, deleted, or never
          existed in this build.
        </p>
        <p>
          <Link href="/projects" className="btn btn-primary btn-md">
            RETURN TO DASHBOARD
          </Link>
        </p>
      </div>
    </div>
  );
}
