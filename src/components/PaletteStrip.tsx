/**
 * Small inline placeholder for a project's paint palette. When the
 * project has no recipe attached we render a single dim text marker
 * — the previous N-dash boxes (UX-V5-003) read like stage cells to
 * users and Ross himself confused them with the StageBarsStrip on
 * /projects rows. One label is honest about the empty state.
 *
 * Once recipe palette ref data lands, this component is bypassed by
 * `RecipePaletteStripStatic` rendering the actual hex swatches.
 */
export function PaletteStrip({ slots: _slots }: { slots?: number } = {}) {
  return (
    <span
      className="inline-flex items-center text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-subtle)]"
      title="No palette yet — attach a recipe to populate"
      aria-label="No palette attached"
    >
      — No palette
    </span>
  );
}
