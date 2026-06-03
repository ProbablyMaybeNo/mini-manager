"use client";

import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useDensity, type Density } from "@/lib/hooks/useDensity";

const OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "comfortable", label: "COMFORTABLE" },
  { value: "compact", label: "COMPACT" },
];

/**
 * D1 — global Comfortable/Compact density control on /user.
 *
 * The single lever for the app-wide density tokens (--density-row-h /
 * --density-card-pad-*, globals.css). Comfortable is the default;
 * Compact tightens table row heights + card padding for pointer-precise
 * desktop work [D §6, §9]. The choice persists in localStorage and is
 * reflected on `<html data-density>` (the root-layout bootstrap applies
 * it before first paint). D4's command palette will add a second entry
 * point to the same hook.
 */
export function DensityCard() {
  const [density, setDensity] = useDensity();

  return (
    <Card title="Display density" ariaLabel="Display density">
      <p className="text-xs font-sans text-[var(--color-fg-subtle)] mb-3 leading-snug">
        How tight the interface packs. Comfortable gives tables and cards
        more breathing room; Compact tightens row heights and padding to fit
        more on screen — handy on a large desktop display. Saved across
        sessions on this device.
      </p>
      <SegmentedControl
        ariaLabel="Display density"
        options={OPTIONS}
        value={density}
        onChange={setDensity}
      />
    </Card>
  );
}
