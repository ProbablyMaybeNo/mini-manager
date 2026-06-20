import Link from "next/link";

/** Themed 404 — replaces Next's default white boundary, which would flash a
 *  white screen inside the pure-black terminal app. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="label-osd text-red">
        SYS ▸ ERROR / 404
      </p>
      <h1 className="font-title text-title text-cyan text-glow-cyan">
        PAGE NOT FOUND
      </h1>
      <p className="max-w-sm font-body text-body text-fg">
        That route isn&apos;t on the grid — it may have moved, or never existed.
      </p>
      <Link
        href="/dashboard"
        className="border border-cyan bg-cyan/15 px-5 py-2 font-button text-button uppercase tracking-[0.15em] text-cyan glow-cyan transition-colors hover:bg-cyan/25"
      >
        ▸ Return to dashboard
      </Link>
    </main>
  );
}
