import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The Mini Mainframe brand mark — the SAME clean mark the sidebar rail uses
 * (cyan rounded accent square + "MINI MAINFRAME" JetBrains-Mono wordmark).
 *
 * UX-010: this replaces the legacy isometric CRT raster (`/logo.png`) that had
 * "Mini-Manager" baked into the artwork — it clashed with the flat HEX.CODE
 * dark theme and predated the "The Mini Mainframe" rename. Reusing the sidebar
 * mark keeps the name consistent across sign-in, the public header, and the
 * mobile top bar.
 *
 * `size` is the square glyph's edge in px; the wordmark scales with it. Pass
 * `markOnly` for a square-only lockup (no wordmark) where space is tight.
 */
export function Logo({
  href = "/dashboard",
  size = 44,
  className,
  markOnly = false,
}: {
  href?: string;
  size?: number;
  className?: string;
  markOnly?: boolean;
}) {
  // Wordmark tracks the glyph size so the lockup scales as one unit.
  const wordSize = Math.max(13, Math.round(size * 0.42));
  return (
    <Link
      href={href}
      aria-label="The Mini Mainframe"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <span
        aria-hidden
        className="shrink-0 rounded-[4px] bg-cyan shadow-[0_0_10px_0_rgba(0,245,255,0.4)]"
        style={{ width: size, height: size }}
      />
      {!markOnly && (
        <span
          className="font-mono font-extrabold tracking-tight text-fg-bright"
          style={{ fontSize: wordSize }}
        >
          MINI&nbsp;MAINFRAME
        </span>
      )}
    </Link>
  );
}
