"use client";

import { Button, Panel, SegmentedToggle } from "@/components/kit";
import { PageHeader } from "@/components/shell";

export type TableDensity = "comfortable" | "compact";

export function SettingsView({
  density,
  onDensityChange,
  onImport,
  onExport,
  onSignOut,
}: {
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  onImport: () => void;
  onExport: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-3 md:gap-6 md:p-6">
      <PageHeader title="SETTINGS" tagline="Preferences and data." />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Panel label="PREFERENCES" className="flex flex-col gap-4 p-4 md:p-5">
          {/* Stacked on phones (MUX-017): side by side, the label wrapped to two
              lines against a one-line control and "COMPACT" clipped to "COMPAC".
              Full-width with equal halves below md; the inline row returns at md. */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span className="label-osd text-fg">
              Table density
            </span>
            <SegmentedToggle
              aria-label="Table density"
              className="w-full md:w-auto"
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
              value={density}
              onChange={onDensityChange}
            />
          </div>
          <p className="font-body text-body text-fg-dim">
            ▸ Motion respects your system “reduce motion” setting automatically.
          </p>
        </Panel>

        <Panel label="DATA" className="flex flex-col gap-3 p-4 md:p-5">
          <p className="font-body text-body text-fg-dim">
            Import a roster or paint list, or export your whole collection.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onImport}>
              ⬆ Import
            </Button>
            <Button variant="secondary" onClick={onExport}>
              ⬇ Export
            </Button>
          </div>
        </Panel>

        {/* Outlined, not filled red (MUX-026): signing out destroys nothing and
            was shouting louder than the genuinely destructive controls
            elsewhere, inverting the danger scale. */}
        <Panel label="SESSION" accent="red" className="flex flex-col gap-3 p-4 md:p-5">
          <p className="font-body text-body text-fg-dim">Sign out of this device.</p>
          <div>
            <Button variant="outlineRed" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
