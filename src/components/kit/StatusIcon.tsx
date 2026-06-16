import { cn } from "@/lib/cn";
import { accentText, type Accent } from "@/lib/palette";

/**
 * Minimal, sharp status icons for activity entries and statuses (DESIGN_LANGUAGE
 * §1 "minimal sharp icons"; activity tracker was missing the Figma status
 * glyphs). Hand-built 16-grid SVG with 1.5px strokes / hard edges — no rounded
 * SaaS icons. Colour comes from `currentColor`, so callers set the accent via
 * `accent` (mapped to the palette) or a text-* class.
 */
export type StatusIconName =
  | "add"
  | "cart"
  | "build"
  | "prime"
  | "paint"
  | "check"
  | "alert";

const PATHS: Record<StatusIconName, React.ReactNode> = {
  // ＋ in a square — "added / created"
  add: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M8 5v6M5 8h6" />
    </>
  ),
  // shopping/acquire — angular cart
  cart: (
    <>
      <path d="M2 3h2l1.6 7h6L14 5H5" />
      <path d="M6 13h.01M12 13h.01" />
    </>
  ),
  // assembly/build — bracketed block
  build: (
    <>
      <path d="M3 3h3M3 3v3M13 3h-3M13 3v3M3 13h3M3 13v-3M13 13h-3M13 13v-3" />
      <rect x="6" y="6" width="4" height="4" />
    </>
  ),
  // priming — half-filled disc
  prime: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M8 2.5v11" />
      <path d="M2.5 2.5H8v11H2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  // painting — brush tip
  paint: (
    <>
      <path d="M11 2l3 3-6 6-3-3z" />
      <path d="M5 8l-3 6 6-3" />
    </>
  ),
  // complete — check in a box
  check: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" />
      <path d="M5 8.5l2 2 4-5" />
    </>
  ),
  // warning/alert — triangle + bang
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
  name: StatusIconName | string;
  accent?: Accent;
  size?: number;
  className?: string;
  title?: string;
}) {
  const paths = PATHS[name as StatusIconName] ?? PATHS.check;
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
