import Link from "next/link";
import { Logo } from "@/components/shell";

/** Minimal public top nav: logo + Gallery + Pricing + Sign in. */
export function PublicHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-cyan/30 px-4 py-3 sm:px-6">
      <Logo href="/" size={44} />
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-5">
        <Link
          href="/gallery"
          className="font-h1 text-h1 uppercase tracking-[0.18em] text-fg hover:text-cyan"
        >
          Gallery
        </Link>
        <Link
          href="/pricing"
          className="font-h1 text-h1 uppercase tracking-[0.18em] text-fg hover:text-cyan"
        >
          Pricing
        </Link>
        <Link
          href="/sign-in"
          className="font-h1 text-h1 uppercase tracking-[0.18em] text-fg hover:text-cyan"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
