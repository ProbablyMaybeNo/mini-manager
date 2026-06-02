"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import {
  ZoneList,
  type ZoneListItem,
} from "@/components/recipes/ZoneList";
import { RecipeNotes } from "@/components/recipes/RecipeNotes";
import { StepList } from "@/components/recipes/StepList";
import type { StepRowData } from "@/components/recipes/StepRow";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

interface Props {
  recipe: Recipe;
  zones: ReadonlyArray<ZoneListItem>;
  initialSelectedZoneId: string | null;
  stepsByZoneId: ReadonlyMap<string, ReadonlyArray<StepRowData>>;
  ownedPaintIds?: ReadonlySet<string>;
}

type Pane = "zones" | "notes";

/**
 * Two-pane recipe editor. Zones + steps live in the main column;
 * notes hang on the right (or stack as a tab on mobile).
 *
 * The silhouette mechanic was dropped — zones are pure text rows with
 * an optional starter-preset for the recipe's bodyType (handled inside
 * `<ZoneList />`). bodyType stays on the recipe row as a metadata tag
 * for the /recipes filter.
 */
export function RecipeEditorClient({
  recipe,
  zones,
  initialSelectedZoneId,
  stepsByZoneId,
  ownedPaintIds,
}: Props) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    initialSelectedZoneId,
  );
  const [activePane, setActivePane] = useState<Pane>("zones");

  return (
    <div className="space-y-4">
      <MobilePaneTabs active={activePane} onChange={setActivePane} />

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section
          className={clsx(
            "space-y-3",
            activePane === "zones" ? "block" : "hidden md:block",
          )}
        >
          <ZoneList
            recipeId={recipe.id}
            bodyType={recipe.bodyType}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
          />
          <SelectedZoneSteps
            zones={zones}
            selectedZoneId={selectedZoneId}
            stepsByZoneId={stepsByZoneId}
            ownedPaintIds={ownedPaintIds}
          />
        </section>

        <section
          className={clsx(
            "space-y-3",
            activePane === "notes" ? "block" : "hidden md:block",
          )}
        >
          <RecipeNotes
            recipeId={recipe.id}
            initialNotes={recipe.notesMd ?? ""}
          />
        </section>
      </div>
    </div>
  );
}

function MobilePaneTabs({
  active,
  onChange,
}: {
  active: Pane;
  onChange: (p: Pane) => void;
}) {
  return (
    <SegmentedControl<Pane>
      ariaLabel="Editor panes"
      options={[
        { value: "zones", label: "Slots" },
        { value: "notes", label: "Notes" },
      ]}
      value={active}
      onChange={onChange}
      fill
      className="md:hidden"
    />
  );
}

function SelectedZoneSteps({
  zones,
  selectedZoneId,
  stepsByZoneId,
  ownedPaintIds,
}: {
  zones: ReadonlyArray<ZoneListItem>;
  selectedZoneId: string | null;
  stepsByZoneId: ReadonlyMap<string, ReadonlyArray<StepRowData>>;
  ownedPaintIds?: ReadonlySet<string>;
}) {
  if (!selectedZoneId) {
    return (
      <p className="text-xs font-sans text-[var(--color-fg-muted)] frame px-3 py-3">
        Select a colour slot to view its steps.
      </p>
    );
  }
  const zone = zones.find((z) => z.id === selectedZoneId);
  if (!zone) return null;
  const steps = stepsByZoneId.get(selectedZoneId) ?? [];
  return (
    <StepList
      zoneId={selectedZoneId}
      zoneName={zone.name}
      steps={steps}
      ownedPaintIds={ownedPaintIds}
    />
  );
}
