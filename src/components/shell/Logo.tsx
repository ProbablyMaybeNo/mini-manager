import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The Mini Mainframe brand lockup — the CRT computer mark + the "MINI MAINFRAME"
 * JetBrains-Mono wordmark. Used at the small sizes (mobile top bar, public
 * header, sign-in/reset/share) where the full poster's on-screen text would be
 * unreadable; the mark carries the visual, the wordmark carries the name.
 *
 * The mark is a transparent PNG (`/brand/mini-mainframe-mark.png`) — the same
 * artwork as the sidebar poster but with no text baked into the screen. The
 * sidebar keeps the larger full poster (its text reads at that size).
 *
 * `size` is the mark's edge in px; the wordmark scales with it. Pass `markOnly`
 * for a mark-only lockup (no wordmark) where space is tight.
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
  // Wordmark tracks the mark size so the lockup scales as one unit.
  const wordSize = Math.max(13, Math.round(size * 0.42));
  return (
    <Link
      href={href}
      aria-label="The Mini Mainframe"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <Image
        src="/brand/mini-mainframe-mark.png"
        alt=""
        aria-hidden
        width={size}
        height={size}
        priority
        className="shrink-0"
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
