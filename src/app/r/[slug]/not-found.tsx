import Link from "next/link";

export default function PublicRecipeNotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="font-mono text-xl text-[var(--color-fg)]">
        Recipe not found
      </h1>
      <p className="font-mono text-sm text-[var(--color-fg-muted)]">
        This recipe was unpublished, or the link is wrong.
      </p>
      {/* tap-target enforces 44px on mobile / 32px on desktop per
          WCAG 2.2 §2.5.8 — the public 404 is the only way back for
          an outside user who landed on a dead share link, so the CTA
          gets the full touch budget. UX-V3-006. */}
      <Link
        href="/"
        className="inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider px-4 py-2 border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] tap-target"
      >
        [ Back to Mini Manager ]
      </Link>
    </div>
  );
}
