import Link from "next/link";

/** Themed 404 — replaces Next's default white boundary, which would flash a
 *  white screen inside the pure-black terminal app. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="label-osd tracking-[0.18em] text-red-text">ERROR / 404</p>
      <h1 className="font-mono text-[clamp(2rem,8vw,3rem)] font-extrabold uppercase leading-none tracking-tight text-fg-bright">
        PAGE NOT FOUND
      </h1>
      <span aria-hidden className="block h-1 w-12 rounded-full bg-cyan" />
      <p className="max-w-sm font-body text-body text-fg-dim">
        That route isn&apos;t on the grid — it may have moved, or never existed.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex items-center gap-2 rounded-[6px] border border-cyan bg-cyan px-5 py-2.5 font-display text-button font-bold uppercase tracking-tight text-bg transition-[background-color] duration-150 hover:bg-cyan/85 focus-visible:outline-2 motion-safe:active:scale-[0.98]"
      >
        ▸ Return to projects
      </Link>
    </main>
  );
}
