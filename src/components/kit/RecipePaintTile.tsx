import { cn } from "@/lib/cn";
import { readableText } from "@/lib/color";
import type { Hex } from "@/lib/types";

/**
 * A large, legible recipe-paint square (Vercel threads l9-Ep, C1Dj, -zP2IB,
 * XBqE). Big enough to read the paint name inside it: company at the TOP,
 * paint name CENTER, layer at the BOTTOM — all in solid black or white chosen
 * for contrast against the swatch fill (-zP2IB: "solid black/white so they are
 * legible on whatever color"). Optionally a button (opens the shared picker).
 */
export function RecipePaintTile({
  hex,
  name,
  brand,
  layer,
  size = "md",
  onClick,
  ariaLabel,
  className,
}: {
  hex: Hex;
  name: string;
  brand?: string;
  layer?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  const ink = readableText(hex);
  const dim =
    size === "sm" ? "h-16 w-16" : size === "lg" ? "h-28 w-28" : "h-20 w-20";

  const content = (
    <span
      className={cn(
        "flex flex-col justify-between border border-fg/20 p-1 text-center leading-tight",
        dim,
        className,
      )}
      style={{ backgroundColor: hex, color: ink }}
    >
      <span className="truncate font-osd text-[12px] uppercase tracking-[0.08em] opacity-90">
        {brand ?? " "}
      </span>
      <span className="line-clamp-2 break-words font-mono text-[12px] font-semibold">
        {name}
      </span>
      <span className="truncate font-osd text-[12px] uppercase tracking-[0.08em] opacity-90">
        {layer || " "}
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `Edit ${name}`}
        className="inline-flex transition-transform hover:scale-[1.03] focus-visible:outline-2"
        title={`${brand ? brand + " " : ""}${name}${layer ? " · " + layer : ""} · ${hex}`}
      >
        {content}
      </button>
    );
  }
  return content;
}

/** Horizontal run of {@link RecipePaintTile}s — the recipe-table "Recipe" cell. */
export function RecipePaintStrip({
  slots,
  size = "md",
  onPaintClick,
  className,
}: {
  slots: ReadonlyArray<{ hex: Hex; name: string; brand?: string; layer?: string }>;
  size?: "sm" | "md" | "lg";
  onPaintClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {slots.map((s, i) => (
        <RecipePaintTile
          key={i}
          hex={s.hex}
          name={s.name}
          brand={s.brand}
          layer={s.layer}
          size={size}
          onClick={onPaintClick ? () => onPaintClick(i) : undefined}
        />
      ))}
    </span>
  );
}
