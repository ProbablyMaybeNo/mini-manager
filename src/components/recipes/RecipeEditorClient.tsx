"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import { InfantrySilhouette } from "@/components/recipes/InfantrySilhouette";
import {
  isInfantryZoneId,
  type InfantryZoneId,
} from "@/lib/silhouettes/infantry";
import {
  ZoneList,
  type ZoneListItem,
} from "@/components/recipes/ZoneList";
import { RecipeNotes } from "@/components/recipes/RecipeNotes";
import { StepList } from "@/components/recipes/StepList";
import type { StepRowData } from "@/components/recipes/StepRow";
import { addZone } from "@/lib/actions/recipeZones";
import { findInfantryZone } from "@/lib/silhouettes/infantry";

interface PaintedSlot {
  swatchHex: string;
}

interface Props {
  recipe: Recipe;
  zones: ReadonlyArray<ZoneListItem>;
  /** Map keyed by silhouette zone id → first-step swatch. */
  paletteBySilhouetteId: ReadonlyMap<string, string>;
  initialSelectedZoneId: string | null;
  /** Map of zoneId → step rows for that zone, server-resolved labels +
   *  swatches included. */
  stepsByZoneId: ReadonlyMap<string, ReadonlyArray<StepRowData>>;
  /** Optional inventory hint for the paint slot picker's owned-only
   *  toggle. */
  ownedPaintIds?: ReadonlySet<string>;
}

type Pane = "body" | "zones" | "notes";

/**
 * Owns the editor's interactive state machine: the selected zone, the
 * mobile-pane toggle, and the "click an unmapped silhouette zone ->
 * offer to add it" inline pill. Delegates rendering to the three pane
 * components.
 */
export function RecipeEditorClient({
  recipe,
  zones,
  paletteBySilhouetteId,
  initialSelectedZoneId,
  stepsByZoneId,
  ownedPaintIds,
}: Props) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    initialSelectedZoneId,
  );
  const [activePane, setActivePane] = useState<Pane>("zones");
  const [pendingSilhouetteAdd, setPendingSilhouetteAdd] = useState<
    InfantryZoneId | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const zonesBySilhouetteId = useMemo(() => {
    const out = new Map<string, ZoneListItem>();
    for (const z of zones) {
      if (z.silhouetteZoneId) out.set(z.silhouetteZoneId, z);
    }
    return out;
  }, [zones]);

  const paintedZones = useMemo(() => {
    const map = new Map<InfantryZoneId, PaintedSlot>();
    for (const [silhouetteId, hex] of paletteBySilhouetteId) {
      if (isInfantryZoneId(silhouetteId)) {
        map.set(silhouetteId, { swatchHex: hex });
      }
    }
    return map;
  }, [paletteBySilhouetteId]);

  const selectedSilhouetteZoneId = useMemo(() => {
    if (!selectedZoneId) return null;
    const z = zones.find((row) => row.id === selectedZoneId);
    if (!z?.silhouetteZoneId) return null;
    return isInfantryZoneId(z.silhouetteZoneId) ? z.silhouetteZoneId : null;
  }, [selectedZoneId, zones]);

  const handleSilhouetteSelect = (id: InfantryZoneId) => {
    const mapped = zonesBySilhouetteId.get(id);
    if (mapped) {
      setSelectedZoneId(mapped.id);
      setPendingSilhouetteAdd(null);
    } else {
      // Not yet a recipe zone — show the inline "add this?" prompt.
      setPendingSilhouetteAdd(id);
    }
  };

  const confirmAddSilhouetteZone = (id: InfantryZoneId) => {
    const meta = findInfantryZone(id);
    if (!meta) return;
    startTransition(async () => {
      const result = await addZone({
        recipeId: recipe.id,
        name: meta.name,
        silhouetteZoneId: meta.id,
      });
      if (result.ok) {
        setSelectedZoneId(result.data.id);
        setPendingSilhouetteAdd(null);
      }
    });
  };

  const unsupportedBodyType = recipe.bodyType !== "infantry";

  return (
    <div className="space-y-4">
      <MobilePaneTabs active={activePane} onChange={setActivePane} />

      <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)_320px] gap-6">
        <section
          className={clsx(
            "space-y-3",
            activePane === "body" ? "block" : "hidden md:block",
          )}
        >
          <h3 className="section-title mb-0 pb-2">Body</h3>
          {unsupportedBodyType ? (
            <div className="frame p-4 text-xs font-sans text-[var(--color-fg-muted)]">
              Body type <strong>{recipe.bodyType}</strong> is not yet
              supported. Vehicle / Monster / Terrain silhouettes ship in
              Phase 6. Switch to <em>infantry</em> to use the silhouette
              picker.
            </div>
          ) : (
            <>
              <InfantrySilhouette
                paintedZones={paintedZones}
                selectedZoneId={selectedSilhouetteZoneId}
                onSelectZone={handleSilhouetteSelect}
                className="frame"
              />
              {pendingSilhouetteAdd ? (
                <PendingZonePrompt
                  silhouetteId={pendingSilhouetteAdd}
                  isPending={isPending}
                  onAdd={() => confirmAddSilhouetteZone(pendingSilhouetteAdd)}
                  onDismiss={() => setPendingSilhouetteAdd(null)}
                />
              ) : null}
            </>
          )}
        </section>

        <section
          className={clsx(
            "space-y-3",
            activePane === "zones" ? "block" : "hidden md:block",
          )}
        >
          <ZoneList
            recipeId={recipe.id}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onSelectZone={(id) => {
              setSelectedZoneId(id);
              setPendingSilhouetteAdd(null);
            }}
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
  const tabs: ReadonlyArray<{ key: Pane; label: string }> = [
    { key: "body", label: "Body" },
    { key: "zones", label: "Zones" },
    { key: "notes", label: "Notes" },
  ];
  return (
    <nav
      aria-label="Editor panes"
      className="md:hidden flex items-center gap-1 frame p-1"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={clsx(
            "flex-1 px-3 py-2 text-xs font-mono uppercase tracking-wider tap-target rounded-sm",
            active === t.key
              ? "text-[var(--color-green)] bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
              : "text-[var(--color-fg-muted)]",
          )}
          aria-pressed={active === t.key}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function PendingZonePrompt({
  silhouetteId,
  isPending,
  onAdd,
  onDismiss,
}: {
  silhouetteId: InfantryZoneId;
  isPending: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  const meta = findInfantryZone(silhouetteId);
  return (
    <div className="frame p-3 flex items-center justify-between gap-3 bg-[var(--color-bg-elevated)]">
      <span className="text-xs font-sans text-[var(--color-fg-muted)]">
        Add <strong className="text-[var(--color-fg)]">{meta?.name}</strong>
        {" "}to the recipe?
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={isPending}
          className={clsx(
            "text-2xs font-mono uppercase tracking-wider px-2 py-1 frame-strong tap-target",
            isPending
              ? "opacity-60 cursor-progress"
              : "hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)] hover:text-[var(--color-green)]",
          )}
        >
          {isPending ? "…" : "[ + ] Add"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
        >
          dismiss
        </button>
      </span>
    </div>
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
        Select a zone to view its steps.
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
