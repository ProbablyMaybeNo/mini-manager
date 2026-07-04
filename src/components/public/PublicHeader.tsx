import Link from "next/link";
import { Logo } from "@/components/shell";

/** Minimal public top nav: logo + Gallery + Pricing + Sign in. */
export function PublicHeader() {
  const linkClass =
    "rounded-[6px] px-1 py-0.5 font-h1 text-h1 uppercase tracking-[0.18em] text-fg transition-colors duration-150 hover:text-cyan-lite focus:outline-none focus-visible:text-cyan-lite";
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
      <Logo href="/" size={44} />
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-5">
        <Link href="/gallery" className={linkClass}>
          Gallery
        </Link>
        <Link href="/pricing" className={linkClass}>
          Pricing
        </Link>
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </nav>
    </header>
  );
}
