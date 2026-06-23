import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The Mini Mainframe CRT logo (exported from Figma). Links home / to dashboard.
 *
 * Enlarged per MM-50 / MM-20 / 63comR8WGVsR / ovBXfJWDLMn7 so the "MINI-MANAGER"
 * text on the CRT screen is legible. Defaults to 120×120 (was 64); the hero and
 * login screens pass a larger size.
 *
 * The CRT artwork has a screen area in roughly the centre. Pass `overlay` to
 * render content (e.g. the boot sequence) positioned inside that screen — used
 * by the landing hero so the separate animation/title section can be removed
 * (thread c2Esss4Nv_v0 / yIZBV2hJ4qG6). `screenInset` tunes the screen window
 * as a fraction of the logo box (defaults calibrated to the exported artwork).
 */
export function Logo({
  href = "/dashboard",
  size = 120,
  className,
  overlay,
  screenInset,
}: {
  href?: string;
  size?: number;
  className?: string;
  overlay?: ReactNode;
  screenInset?: { top: string; right: string; bottom: string; left: string };
}) {
  const inset = screenInset ?? { top: "26%", right: "16%", bottom: "30%", left: "16%" };
  const img = (
    <Image
      src="/logo.png"
      alt="The Mini Mainframe"
      width={size}
      height={size}
      priority
      className="select-none"
    />
  );

  if (overlay) {
    return (
      <Link
        href={href}
        aria-label="The Mini Mainframe"
        className={cn("relative inline-block", className)}
        style={{ width: size, height: size }}
      >
        {img}
        <span
          aria-hidden={false}
          className="pointer-events-none absolute overflow-hidden"
          style={{ inset: `${inset.top} ${inset.right} ${inset.bottom} ${inset.left}` }}
        >
          {overlay}
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} aria-label="The Mini Mainframe" className={cn("inline-block", className)}>
      {img}
    </Link>
  );
}
