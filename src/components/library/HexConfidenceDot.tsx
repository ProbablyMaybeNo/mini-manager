import type { HexConfidence } from "@/lib/paints/types";
import { clsx } from "clsx";

const COLOR: Record<HexConfidence, string> = {
  high: "bg-[var(--color-green)]",
  medium: "bg-[var(--color-amber)]",
  low: "bg-[var(--color-fg-subtle)]",
};

const LABEL: Record<HexConfidence, string> = {
  high: "Hand-painted swatch (Stahly)",
  medium: "Manufacturer-published hex",
  low: "Community / unknown source",
};

export function HexConfidenceDot({
  confidence,
  source,
  className,
}: {
  confidence: HexConfidence;
  source?: string;
  className?: string;
}) {
  const tooltip = source ? `${LABEL[confidence]} — ${source}` : LABEL[confidence];
  return (
    <span
      className={clsx(
        "inline-block h-2 w-2 rounded-full shrink-0",
        COLOR[confidence],
        className,
      )}
      title={tooltip}
      aria-label={tooltip}
    />
  );
}
