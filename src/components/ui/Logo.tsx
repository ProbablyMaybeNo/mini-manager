import Image from "next/image";
import { clsx } from "clsx";

export interface LogoProps {
  /** Force a fixed pixel width — useful for compact lockups (e.g. a
   *  future header bar). Without it the logo fills its parent (auth
   *  cards are wrapped in a `max-w-md` panel, so it caps at panel width). */
  width?: number;
  className?: string;
  /** Provide hidden-text-only flag if rendering as a redundant decoration
   *  next to a visible heading. Defaults to false (the image carries the
   *  wordmark, so it gets a real alt). */
  decorative?: boolean;
}

/**
 * Brand logo primitive. Wraps the engraved CRT cyan-on-black artwork at
 * `public/brand/logo.png` and renders it with `mix-blend-mode: screen`
 * so the PNG's black background drops out onto our near-black surfaces
 * — the cyan engraving reads as glyphs on the page, not as a card on a
 * card.
 *
 * Default sizing fills the parent — auth pages wrap the logo in a
 * `max-w-md` panel so it lands at ~448px square on desktop and shrinks
 * with the viewport on mobile. Pass an explicit `width` for compact
 * lockups (e.g. navbars).
 *
 * The wordmark itself spells "Mini-Manager", so the alt text restates
 * it for screen readers. Pass `decorative` when pairing the logo with
 * a visible heading that already reads "Mini Manager" — that case sets
 * `alt=""` + `aria-hidden`.
 */
export function Logo({ width, className, decorative = false }: LogoProps) {
  const alt = decorative ? "" : "Mini Manager";
  return (
    <Image
      src="/brand/logo.png"
      alt={alt}
      // Intrinsic dimensions match the source (1254×1254 square).
      width={width ?? 1254}
      height={width ?? 1254}
      priority
      aria-hidden={decorative || undefined}
      className={clsx(
        "logo-screen",
        width ? "" : "w-full h-auto",
        className,
      )}
    />
  );
}
