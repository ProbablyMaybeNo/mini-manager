"use client";

import { useState } from "react";
import { Button, Input, Panel, SearchField, SlideOutPanel, Swatch } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import type { Paint, Project, Recipe, RecipeSlot } from "@/lib/types";
import { SlotRow } from "./SlotRow";

export function RecipeEditorView({
  recipe,
  projects,
  paints,
  onChange,
  onShare,
  onBack,
  onSave,
}: {
  recipe: Recipe;
  projects: Project[];
  paints: Paint[];
  onChange: (next: Recipe) => void;
  onShare: () => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const [inspoUrl, setInspoUrl] = useState("");

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

  function pickPaint(paint: Paint) {
    if (pickingSlot == null) return;
    const slots = recipe.slots.map((s, i) =>
      i === pickingSlot
        ? { ...s, paintId: paint.id, swatch: paint.hex, brand: paint.brand, name: paint.name }
        : s,
    );
    updateSlots(slots);
    setPickingSlot(null);
    setPickQuery("");
  }

  function moveSlot(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= recipe.slots.length) return;
    const slots = [...recipe.slots];
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
    updateSlots(slots);
  }

  const filteredPaints = paints
    .filter((p) =>
      pickQuery.trim()
        ? `${p.name} ${p.brand}`.toLowerCase().includes(pickQuery.trim().toLowerCase())
        : true,
    )
    .slice(0, 60);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <Button variant="tertiary" onClick={onBack}>
          ← Recipes
        </Button>
      </div>

      <PageHeader title="RECIPE EDITOR" tagline="Capture a repeatable scheme, attach it to a project, and share it." />

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
            className="border border-cyan/50 bg-bg px-2 py-1.5 font-mono text-sm text-fg focus:border-cyan focus:outline-none"
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Slots */}
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
          <Button variant="secondary" onClick={addSlot}>
            + Add slot
          </Button>
        </Panel>

        <div className="flex flex-col gap-6">
          {/* Notes */}
          <Panel label="NOTES" className="p-4">
            <textarea
              value={recipe.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              aria-label="Recipe notes"
              rows={5}
              placeholder="General notes — varnish, basing, sub-assembly order…"
              className="w-full resize-y border border-cyan/40 bg-bg p-2 font-mono text-xs text-fg placeholder:text-fg-faint focus:border-cyan focus:outline-none"
            />
          </Panel>

          {/* Inspiration */}
          <Panel label="INSPIRATION" className="flex flex-col gap-3 p-4">
            <div className="flex gap-2">
              <Input
                name="inspo"
                placeholder="Paste reference URL"
                value={inspoUrl}
                onChange={(e) => setInspoUrl(e.target.value)}
                containerClassName="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inspoUrl.trim()) {
                    update({ inspoLinks: [...recipe.inspoLinks, inspoUrl.trim()] });
                    setInspoUrl("");
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!inspoUrl.trim()) return;
                  update({ inspoLinks: [...recipe.inspoLinks, inspoUrl.trim()] });
                  setInspoUrl("");
                }}
              >
                Add
              </Button>
            </div>
            {recipe.inspoLinks.length === 0 ? (
              <p className="font-mono text-[11px] text-fg-faint">
                No references yet — paste image or page URLs.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {recipe.inspoLinks.map((url, i) => (
                  <div
                    key={i}
                    className="group relative flex aspect-square items-center justify-center border border-cyan/40 bg-bg-raised/40 p-1"
                  >
                    <span className="truncate font-mono text-[9px] text-fg-dim">{url}</span>
                    <button
                      type="button"
                      aria-label={`Remove reference ${i + 1}`}
                      onClick={() =>
                        update({ inspoLinks: recipe.inspoLinks.filter((_, k) => k !== i) })
                      }
                      className="absolute right-0.5 top-0.5 font-osd text-[10px] text-fg-faint hover:text-red"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Paint picker (library) */}
      <SlideOutPanel
        open={pickingSlot != null}
        onClose={() => setPickingSlot(null)}
        title="Pick a paint"
        breadcrumb="RECIPE ▸ LIBRARY PICKER"
      >
        <div className="flex flex-col gap-3">
          <SearchField
            name="pick-search"
            value={pickQuery}
            onChange={(e) => setPickQuery(e.target.value)}
          />
          <p className="font-mono text-[10px] text-fg-faint">
            ▸ Or pick visually from the Wheel / Eyedropper in Tools.
          </p>
          <ul className="flex flex-col gap-1">
            {filteredPaints.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickPaint(p)}
                  className="flex w-full items-center gap-2 border border-transparent px-1 py-1 text-left hover:border-cyan/40 hover:bg-cyan/5"
                >
                  <Swatch hex={p.hex} size="sm" />
                  <span className="flex-1 truncate font-mono text-xs text-fg">{p.name}</span>
                  <span className="font-osd text-[9px] uppercase text-fg-faint">{p.brand}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </SlideOutPanel>
    </div>
  );
}
