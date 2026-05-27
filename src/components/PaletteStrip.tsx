/**
 * A row of small color swatches showing the paints used in a project.
 * Phase 1 placeholder: paints aren't wired up yet, so it renders empty
 * slots (dimmed dashes) as a layout reservation. Real paint refs land
 * with Recipe in Phase 3.
 */
export function PaletteStrip({ slots = 6 }: { slots?: number }) {
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label="Paint palette (empty)"
    >
      {Array.from({ length: slots }).map((_, i) => (
        <span
          key={i}
          className="inline-block w-4 h-4 border border-[var(--color-border)] text-[var(--color-fg-subtle)] text-2xs leading-none flex items-center justify-center"
          aria-hidden
        >
          —
        </span>
      ))}
    </div>
  );
}
