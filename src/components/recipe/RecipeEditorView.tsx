"use client";

import { useState } from "react";
import { Button, Input, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { ColorPickerPanel } from "@/components/tools/ColorPickerPanel";
import type { Project, Recipe, RecipeSlot } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { SlotRow } from "./SlotRow";

export function RecipeEditorView({
  recipe,
  projects,
  onChange,
  onShare,
  onBack,
  onSave,
  resolvePaintMeta,
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
          ← Recipes
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
          <span className="font-osd text-[10px] uppercase tracking-[0.18em] text-fg-dim">
            Assign to project
          </span>
          <select
            value={recipe.assignedProjectId ?? ""}
            onChange={(e) => update({ assignedProjectId: e.target.value || undefined })}
            className="border border-cyan/40 bg-bg px-2 py-1.5 font-mono text-sm text-fg focus:border-cyan focus:outline-none"
          >
            <option value="">Unassigned</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" onClick={onShare}>
          Share
        </Button>
        <Button onClick={onSave}>Save</Button>
      </Panel>

      {/* ndZ9 — inspiration removed from the creator; the freed space lets the
          slots + notes use the full width (luPYg). zfnUz — borders thinned to
          cyan/20 across the editor sections. */}
      <Panel label="SLOTS" cornerTicks className="flex flex-col gap-3 p-4">
        {recipe.slots.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-fg-faint">
            No slots yet — add your first paint layer.
          </p>
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
        <Button variant="add" onClick={addSlot}>
          + Add slot
        </Button>
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
          className="w-full resize-y border border-cyan/40 bg-bg p-2 font-mono text-xs text-fg placeholder:text-fg-faint focus:border-cyan focus:outline-none"
        />
      </Panel>

      {/* MM-25 — the shared 3-panel ColorPicker (wheel + library + eyedropper)
          replaces the old text-only "Pick a paint" search. Stays open for
          multi-add. */}
      <ColorPickerPanel
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
