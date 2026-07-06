"use client";

import { useState } from "react";
import { Button, Input, Listbox, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { Project, Recipe, RecipeSlot } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { RecipePaintPicker } from "./RecipePaintPicker";
import { EmptySchemeExample, SchemePreview } from "./SchemePreview";
import { SlotRow } from "./SlotRow";

export function RecipeEditorView({
  recipe,
  projects,
  onChange,
  onShare,
  onBack,
  onSave,
  resolvePaintMeta,
  backLabel = "← Recipes",
}: {
  recipe: Recipe;
  projects: Project[];
  onChange: (next: Recipe) => void;
  onShare: () => void;
  onBack: () => void;
  onSave: () => void;
  /** Resolve a picked paint id → display brand/name (catalog lives in the
   *  picker; the editor only needs the labels for the slot row). */
  resolvePaintMeta?: (paintId: string) => { brand: string; name: string } | null;
  /** Back-button label. When the recipe is attached to (or was created from) a
   *  project, the controller passes "‹ back to <project>" so the painter
   *  returns to that project instead of the recipe index. */
  backLabel?: string;
}) {
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  const update = (patch: Partial<Recipe>) => onChange({ ...recipe, ...patch });
  const updateSlots = (slots: RecipeSlot[]) => update({ slots });

  function addSlot() {
    const blank: RecipeSlot = {
      paintId: "",
      swatch: "#1c2e44",
      brand: "—",
      name: "Pick a paint",
      layer: "",
      note: "",
    };
    updateSlots([...recipe.slots, blank]);
    setPickingSlot(recipe.slots.length);
  }

  /** Apply a ColorPicker selection to the slot being edited. A library pick
   *  carries a paintId (resolved to brand/name); a raw hex (wheel / harmony /
   *  eyedropper) lands as a custom-colour slot. The panel stays open so the
   *  painter can keep adding (old multi-add behaviour, MM-25). */
  function applySelection(sel: ColorPickerSelection) {
    if (pickingSlot == null) return;
    const meta = sel.paintId ? resolvePaintMeta?.(sel.paintId) ?? null : null;
    const slots = recipe.slots.map((s, i) =>
      i === pickingSlot
        ? {
            ...s,
            paintId: sel.paintId ?? "",
            swatch: sel.hex,
            brand: meta?.brand ?? (sel.paintId ? s.brand : "Custom"),
            name: meta?.name ?? (sel.paintId ? s.name : sel.hex),
          }
        : s,
    );
    updateSlots(slots);
  }

  function moveSlot(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= recipe.slots.length) return;
    const slots = [...recipe.slots];
    [slots[i], slots[j]] = [slots[j], slots[i]];
    updateSlots(slots);
  }

  const editing = pickingSlot != null ? recipe.slots[pickingSlot] : null;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <Button variant="tertiary" onClick={onBack}>
          {backLabel}
        </Button>
      </div>

      <PageHeader
        title="RECIPE EDITOR"
        tagline="Capture a repeatable scheme, attach it to a project, and share it."
      />

      {/* Title + assign + share */}
      <Panel label="DETAILS" className="flex flex-col gap-4 p-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Input
            label="Recipe name"
            name="title"
            value={recipe.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="label-osd text-fg">
            Assign to project
          </span>
          <Listbox
            size="md"
            value={recipe.assignedProjectId ?? ""}
            ariaLabel="Assign to project"
            placeholder="Unassigned"
            onChange={(v) => update({ assignedProjectId: v || undefined })}
            options={[
              { value: "", label: "Unassigned" },
              ...projects.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
        </div>
        {/* 28:4 footer actions: SHARE LINK (outline), SAVE RECIPE (green),
            ATTACH RECIPE (blue). Share stays the green outline link affordance. */}
        <Button variant="secondary" onClick={onShare}>
          ⛓ Share Link
        </Button>
        <Button variant="add" onClick={onSave}>
          Save Recipe
        </Button>
        <Button
          variant="solidCyan"
          className="border-blue bg-blue hover:bg-blue/85"
          onClick={onSave}
        >
          Attach Recipe
        </Button>
      </Panel>

      {/* ndZ9 — inspiration removed from the creator; the freed space lets the
          slots + notes use the full width (luPYg). zfnUz — borders thinned to
          cyan/20 across the editor sections. */}
      <Panel label="SLOTS" cornerTicks className="flex flex-col gap-3 p-4">
        {/* DOP-011 — live ordered-scheme preview: the layers render as labelled
            swatches the moment they exist, so the painter sees the build the way
            it'll appear on the recipe list / card. */}
        <SchemePreview slots={recipe.slots} />
        {recipe.slots.length === 0 ? (
          // DOP-011 — empty-state slot with a worked three-layer example.
          <EmptySchemeExample />
        ) : (
          recipe.slots.map((slot, i) => (
            <SlotRow
              key={i}
              slot={slot}
              index={i}
              isFirst={i === 0}
              isLast={i === recipe.slots.length - 1}
              onPick={() => setPickingSlot(i)}
              onRemove={() => updateSlots(recipe.slots.filter((_, k) => k !== i))}
              onMove={(dir) => moveSlot(i, dir)}
              onLayerChange={(layer) =>
                updateSlots(recipe.slots.map((s, k) => (k === i ? { ...s, layer } : s)))
              }
              onNoteChange={(note) =>
                updateSlots(recipe.slots.map((s, k) => (k === i ? { ...s, note } : s)))
              }
            />
          ))
        )}
        {/* + ADD PAINT — dashed full-width affordance (28:4). */}
        <button
          type="button"
          onClick={addSlot}
          className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-cyan/40 py-3 font-mono text-body font-bold uppercase tracking-wide text-cyan-lite transition-colors hover:bg-cyan/5"
        >
          + Add Paint
        </button>
      </Panel>

      {/* -bxkX — Notes shortened (rows 3) so the panel sits symmetric with the
          slot rows above rather than towering over them. */}
      <Panel label="NOTES" className="p-4">
        <textarea
          value={recipe.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          aria-label="Recipe notes"
          rows={3}
          placeholder="General notes — varnish, basing, sub-assembly order…"
          className="w-full resize-y border border-cyan/40 bg-bg p-2 font-body text-body text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
        />
      </Panel>

      {/* UX-002 — clicking a slot opens the FULL paint-creator toolset (wheel +
          filterable library + dropper + match + layering), matching the Figma
          Recipe.png right-rail, not the reduced wheel-only picker. Stays open
          for multi-add; every tool's "use" funnels through applySelection. */}
      <RecipePaintPicker
        open={pickingSlot != null}
        onClose={() => setPickingSlot(null)}
        onSelect={applySelection}
        contextLabel={pickingSlot != null ? `Slot ${pickingSlot + 1}` : undefined}
        mode={editing && editing.paintId ? "edit-slot" : "add-slot"}
        initialHex={editing?.swatch ?? null}
        initialPaintId={editing?.paintId || null}
      />
    </div>
  );
}
