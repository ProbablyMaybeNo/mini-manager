import type { PaintType } from "@/lib/paints/types";
import { clsx } from "clsx";

/**
 * Single-glyph type icons for the library table. Matches the v1 TypeLegend
 * glyph set so the visual language carries over between releases.
 */
const GLYPH: Record<PaintType, string> = {
  Paint: "○",
  Wash: "≋",
  Contrast: "◆",
  Metallic: "✦",
  Air: "⌒",
  Primer: "▣",
  Varnish: "◌",
  Pigment: "·",
  Effect: "◐",
  Ink: "✎",
  Lacquer: "◇",
};

export function TypeIcon({
  type,
  className,
}: {
  type: PaintType;
  className?: string;
}) {
  return (
    <span
      className={clsx("inline-flex w-4 justify-center font-mono text-sm", className)}
      aria-label={type}
      title={type}
    >
      {GLYPH[type]}
    </span>
  );
}
