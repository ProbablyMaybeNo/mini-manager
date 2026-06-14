import Link from "next/link";
import { Logo } from "@/components/shell";

/** Minimal public top nav: logo + Pricing + Sign in. */
export function PublicHeader() {
  return (
    <header className="flex items-center justify-between border-b border-cyan/30 px-6 py-3">
      <Logo href="/" size={44} />
      <nav className="flex items-center gap-5">
        <Link
          href="/pricing"
          className="font-osd text-xs uppercase tracking-[0.18em] text-fg-dim hover:text-cyan"
        >
          Pricing
        </Link>
        <Link
          href="/sign-in"
          className="font-osd text-xs uppercase tracking-[0.18em] text-fg-dim hover:text-cyan"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
