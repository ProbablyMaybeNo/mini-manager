"use client";

import { Button, Panel, SegmentedToggle } from "@/components/kit";
import { PageHeader } from "@/components/shell";

export interface PlanInfo {
  name: string;
  renews?: string;
}

export type TableDensity = "comfortable" | "compact";

export function SettingsView({
  plan,
  density,
  onDensityChange,
  onUpgrade,
  onImport,
  onExport,
  onSignOut,
}: {
  plan: PlanInfo;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
  onUpgrade: () => void;
  onImport: () => void;
  onExport: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <PageHeader title="SETTINGS" tagline="Plan, preferences, and data." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel label="PLAN" cornerTicks className="flex flex-col gap-3 p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-base text-cyan">{plan.name}</span>
            {plan.renews && (
              <span className="font-body text-body text-fg">Renews {plan.renews}</span>
            )}
          </div>
          <p className="font-body text-body text-fg">
            {plan.name === "Free"
              ? "Upgrade for unlimited projects, sharing, and the full tool suite."
              : "Thanks for supporting The Mini Mainframe."}
          </p>
          <div>
            <Button onClick={onUpgrade}>{plan.name === "Free" ? "Upgrade" : "Manage billing"}</Button>
          </div>
        </Panel>

        <Panel label="PREFERENCES" className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <span className="label-osd text-fg">
              Table density
            </span>
            <SegmentedToggle
              aria-label="Table density"
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
              value={density}
              onChange={onDensityChange}
            />
          </div>
          <p className="font-body text-body text-fg">
            ▸ Motion respects your system “reduce motion” setting automatically.
          </p>
        </Panel>

        <Panel label="DATA" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">
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

        <Panel label="SESSION" accent="red" className="flex flex-col gap-3 p-5">
          <p className="font-body text-body text-fg">Sign out of this device.</p>
          <div>
            <Button variant="danger" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
