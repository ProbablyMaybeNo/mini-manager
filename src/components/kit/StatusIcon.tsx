import { cn } from "@/lib/cn";
import { accentText, type Accent } from "@/lib/palette";
import type { ProjectStatus } from "@/lib/types";

/**
 * Status / activity glyphs. Ross's pixel-art SVGs (Library/Icons → copied to
 * public/icons/status) are the canonical artwork for the lifecycle states and
 * the activity-feed moves — they carry their own palette colour baked in
 * (Wishlist yellow, Owned green, Priming purple, Painting cyan, build red,
 * Completed green), so they render as <img> as-is rather than via currentColor.
 *
 * Keys that have no bespoke asset (alert, the BASING / SHELVED statuses) fall
 * back to the hand-built sharp inline glyphs so a missing artwork never blanks
 * an icon. Colour for the fallbacks comes from `currentColor` / the `accent`.
 */
export type StatusIconName =
  | "add"
  | "cart"
  | "build"
  | "prime"
  | "paint"
  | "check"
  | "alert";

/**
 * Filename map for Ross's pixel-art assets (public/icons/status/<file>). Both
 * the activity-feed icon keys AND the ProjectStatus enum resolve through here,
 * so the same artwork drives the feed rows and the status indicators.
 */
const ASSETS: Record<string, { src: string; label: string }> = {
  // Activity-feed icon keys → artwork (semantic match to the lifecycle stage).
  add: { src: "/icons/status/wishlist.svg", label: "wishlist" },
  cart: { src: "/icons/status/owned.svg", label: "owned" },
  build: { src: "/icons/status/build.svg", label: "build" },
  prime: { src: "/icons/status/priming.svg", label: "priming" },
  paint: { src: "/icons/status/painting.svg", label: "painting" },
  check: { src: "/icons/status/completed.svg", label: "completed" },
  // ProjectStatus enum → artwork.
  WISHLIST: { src: "/icons/status/wishlist.svg", label: "wishlist" },
  OWNED: { src: "/icons/status/owned.svg", label: "owned" },
  BUILDING: { src: "/icons/status/build.svg", label: "build" },
  PRIMING: { src: "/icons/status/priming.svg", label: "priming" },
  PAINTING: { src: "/icons/status/painting.svg", label: "painting" },
  BASING: { src: "/icons/status/painting.svg", label: "basing" },
  COMPLETE: { src: "/icons/status/completed.svg", label: "completed" },
};

const FALLBACK_PATHS: Record<string, React.ReactNode> = {
  // ＋ in a square — "added / created"
  add: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M8 5v6M5 8h6" />
    </>
  ),
  cart: (
    <>
      <path d="M2 3h2l1.6 7h6L14 5H5" />
      <path d="M6 13h.01M12 13h.01" />
    </>
  ),
  build: (
    <>
      <path d="M3 3h3M3 3v3M13 3h-3M13 3v3M3 13h3M3 13v-3M13 13h-3M13 13v-3" />
      <rect x="6" y="6" width="4" height="4" />
    </>
  ),
  prime: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M8 2.5v11" />
      <path d="M2.5 2.5H8v11H2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  paint: (
    <>
      <path d="M11 2l3 3-6 6-3-3z" />
      <path d="M5 8l-3 6 6-3" />
    </>
  ),
  check: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M5 8.5l2 2 4-5" />
    </>
  ),
  // warning/alert — triangle + bang (no bespoke asset)
  alert: (
    <>
      <path d="M8 2.5L14 13.5H2z" />
      <path d="M8 6.5v3.5M8 11.5h.01" />
    </>
  ),
};

export function StatusIcon({
  name,
  accent,
  size = 14,
  className,
  title,
}: {
  name: StatusIconName | ProjectStatus | string;
  accent?: Accent;
  size?: number;
  className?: string;
  title?: string;
}) {
  const asset = ASSETS[name];
  if (asset) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static pixel-art glyph, no optimisation wanted (crisp edges)
      <img
        src={asset.src}
        alt={title ?? ""}
        title={title}
        width={size}
        height={size}
        aria-hidden={title ? undefined : true}
        style={{ imageRendering: "pixelated" }}
        className={cn("inline-block shrink-0 object-contain", className)}
      />
    );
  }

  const paths = FALLBACK_PATHS[name] ?? FALLBACK_PATHS.check;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      shapeRendering="crispEdges"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", accent && accentText[accent], className)}
    >
      {title ? <title>{title}</title> : null}
      {paths}
    </svg>
  );
}
