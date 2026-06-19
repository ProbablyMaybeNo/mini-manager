"use client";

/** Themed route-level error boundary (keeps the terminal aesthetic on a crash). */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="label-osd text-red">
        SYS ▸ FAULT
      </p>
      <h1 className="font-display text-xl text-red">SOMETHING BROKE</h1>
      <p className="max-w-sm font-mono text-sm text-fg-dim">
        An unexpected error interrupted the session. Try again — if it persists,
        reload the page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="border border-cyan bg-cyan/15 px-5 py-2 font-osd text-xs uppercase tracking-[0.15em] text-cyan glow-cyan transition-colors hover:bg-cyan/25"
      >
        ▸ Retry
      </button>
    </main>
  );
}
