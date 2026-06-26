import { cn } from "@/lib/cn";

/**
 * The shared FOCUS affordance glyph (RF-2): a target/crosshair reticle — four
 * `+`-arm ticks around a centred circle — rendered in the purple accent (NOT
 * red; the old red pixel target is retired). One definition, used everywhere
 * Focus appears: the inspector action bar and the projects-table row action.
 *
 * Drawn as a vector (not pixel art) so it stays crisp at both the dense table
 * row glyph size (≥24px) and the larger action-bar size. `size` is the glyph
 * box in px; stroke scales with it. `aria-hidden` — the interactive wrapper
 * (button) carries the accessible name + colour.
 */
export function FocusReticleIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("text-purple", className)}
    >
      {/* centre circle */}
      <circle cx="12" cy="12" r="4.5" />
      {/* crosshair arms — a `+` reaching from each edge toward the circle */}
      <line x1="12" y1="1.5" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22.5" y2="12" />
    </svg>
  );
}
