import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";

/**
 * The public footer — Gallery / Support / Sign in / Privacy / Terms / Contact.
 *
 * Extracted from `LandingView` when the SEO landing pages needed the same row:
 * these links are the crawlable path off every marketing surface, and four
 * hand-copied versions is four chances for one of them to lose a link.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-cyan/20 px-6 py-6 text-center font-body text-body text-fg">
      ▸ THE MINI MAINFRAME · made for painters ·{" "}
      <Link href="/gallery" className="text-cyan-lite underline">
        Gallery
      </Link>{" "}
      ·{" "}
      <Link href="/pricing" className="text-cyan-lite underline">
        Support
      </Link>{" "}
      ·{" "}
      <Link href="/sign-in" className="text-cyan-lite underline">
        Sign in
      </Link>{" "}
      ·{" "}
      <Link href="/privacy" className="text-cyan-lite underline">
        Privacy
      </Link>{" "}
      ·{" "}
      <Link href="/terms" className="text-cyan-lite underline">
        Terms
      </Link>{" "}
      ·{" "}
      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-cyan-lite underline">
        Contact
      </a>
    </footer>
  );
}
