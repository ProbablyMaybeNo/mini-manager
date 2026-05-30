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
      <Link
        href="/"
        className="inline-block font-mono text-xs uppercase tracking-wider px-3 py-1.5 border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
      >
        [ Back to Mini Manager ]
      </Link>
    </div>
  );
}
