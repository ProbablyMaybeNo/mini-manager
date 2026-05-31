import Image from "next/image";
import { clsx } from "clsx";

export interface LogoProps {
  /** Force a fixed pixel width — handy on auth-page hero placement.
   *  Defaults to a responsive sizing pair (~110px mobile / ~140px md+). */
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
 * Default sizing follows the auth-page hero spec from PHASE9_PLAN.md:
 * ~140px wide on md+, ~110px on mobile. Override `width` for inline
 * lockups elsewhere.
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
        width ? "" : "w-[110px] md:w-[140px] h-auto",
        className,
      )}
    />
  );
}
