import Link from "next/link";
import { Logo } from "@/components/shell";

/** Minimal public top nav: logo + Gallery + Pricing + Sign in. */
export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-cyan/30 px-6 py-3">
      <Logo href="/" size={44} />
      <nav className="flex items-center gap-5">
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
