"use client";

import { useState } from "react";
import { Button, Input, Listbox, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/cn";
import type { Project, Recipe, RecipeSlot } from "@/lib/types";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import { RecipePaintPicker } from "./RecipePaintPicker";
import { EmptySchemeExample, SchemePreview } from "./SchemePreview";
import { ShareCardComposer } from "./ShareCardComposer";
import { SlotRow } from "./SlotRow";

export function RecipeEditorView({
  recipe,
  projects,
  onChange,
  onShare,
  onBack,
  onSave,
  onDelete,
  onAiGenerate,
  resolvePaintMeta,
  backLabel = "← Recipes",
}: {
  recipe: Recipe;
  projects: Project[];
  onChange: (next: Recipe) => void;
  onShare: () => void;
  onBack: () => void;
  onSave: () => void;
  /** Open the AI Recipe Creator. REQUIRED, not optional: the sibling
   *  RecipeIndexView made this prop optional and then no caller ever passed
   *  it, so its AI button silently never rendered. */
  onAiGenerate: () => void;
  /** Delete this recipe. Omitted (or hidden) for unsaved "new" drafts, which
   *  have nothing to delete yet. */
  onDelete?: () => void;
  /** Resolve a picked paint id → display brand/name (catalog lives in the
   *  picker; the editor only needs the labels for the slot row). */
  resolvePaintMeta?: (paintId: string) => { brand: string; name: string } | null;
  /** Back-button label. When the recipe is attached to (or was created from) a
   *  project, the controller passes "‹ back to <project>" so the painter
   *  returns to that project instead of the recipe index. */
  backLabel?: string;
}) {
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  /** Phone-only disclosure for the secondary recipe actions (MUX2-004). */
  const [actionsOpen, setActionsOpen] = useState(false);

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
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 md:gap-6 md:p-6">
      <div className="flex items-center gap-3">
        {/* backLabel can be "‹ back to <project title>" — keep the user's
            project name in its real casing rather than shouting it. */}
        <Button variant="tertiary" normalCase onClick={onBack}>
          {backLabel}
        </Button>
      </div>

      <PageHeader
        title="RECIPE EDITOR"
        tagline="Capture a repeatable scheme, attach it to a project, and share it."
      />

      {/* Title + assign + share */}
      {/* `flex-wrap` + a real min-width on the name field (MUX4-001). The
          single-line desktop row needs ~1050–1270px and never wrapped, so on
          every landscape phone (which clears `md`) the name input collapsed to
          28px — showing "Sala" of "Salamanders Green Scheme" — and Attach and
          Delete rendered up to 425px past the right edge inside a container with
          no scrollbar or fade to say they were there. */}
      <Panel label="DETAILS" className="flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-end md:gap-4 md:p-4">
        <div className="min-w-[12rem] flex-1">
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
            ATTACH RECIPE (blue). Desktop keeps all five in one row via
            `md:contents`, unchanged.

            On phones, only SAVE stays in DETAILS. Round 1 aligned these five
            (159×44, clean baselines) but the block still pushed step 01 to
            y=681 — 84% of the fold spent before a single step, on the screen
            whose entire job is editing steps (MUX2-004). SAVE is the one filled
            primary; the rest sit behind a disclosure, which also stops SAVE and
            ATTACH reading as two co-equal primaries.

            Short labels ONLY where space is tight — the extra word is a span
            that's display:none below md, so it drops out of the accessible name
            on phones and stays in it on desktop. */}
        <Button
          variant="add"
          onClick={onSave}
          className="order-last h-11 whitespace-nowrap md:order-none md:h-auto"
        >
          Save<span className="hidden md:inline">&nbsp;Recipe</span>
        </Button>

        <div className="order-last flex flex-col gap-2 md:contents">
          <button
            type="button"
            aria-expanded={actionsOpen}
            aria-controls="recipe-more-actions"
            onClick={() => setActionsOpen((v) => !v)}
            className="flex min-h-11 items-center gap-2 rounded-[6px] border border-border px-3 font-button text-button uppercase tracking-[0.12em] text-fg-dim transition-colors hover:border-cyan/40 hover:text-fg md:hidden"
          >
            <span aria-hidden className={cn("text-cyan-lite transition-transform", actionsOpen && "rotate-90")}>
              ▸
            </span>
            Share, attach &amp; delete
          </button>
          <div
            id="recipe-more-actions"
            className={cn(actionsOpen ? "grid" : "hidden", "grid-cols-2 gap-2 md:contents")}
          >
            {/* Audit B8 — the editor had NO AI affordance at all while the
                /recipes detail panel showed one to everyone, badged PRO, that
                opens the paywall on click. A non-subscriber could discover the
                feature from the list and not from the creator, which is the
                surface the feature is for. Same markup as RecipeWorkbench's
                button so the two read identically; AiRecipeDialog does the
                gating itself, so this stays visible for everyone. */}
            <button
              type="button"
              onClick={onAiGenerate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-orange bg-surface px-4 font-mono text-[12px] font-bold text-fg-bright transition-colors hover:bg-orange/10 md:h-auto md:py-2.5"
            >
              ⚡ AI GENERATE
              <span className="rounded-[2px] bg-orange px-1 py-px font-mono text-[8px] font-extrabold text-bg">
                PRO
              </span>
            </button>
            <Button variant="secondary" onClick={onShare} className="h-11 whitespace-nowrap md:h-auto">
              ⛓ Share<span className="hidden md:inline">&nbsp;Link</span>
            </Button>
            <Button
              variant="outlineCyan"
              onClick={() => setShareCardOpen(true)}
              className="h-11 whitespace-nowrap md:h-auto"
            >
              ⬡ Share<span className="hidden md:inline">&nbsp;as</span>&nbsp;Card
            </Button>
            <Button
              variant="solidCyan"
              className="h-11 whitespace-nowrap border-blue bg-blue hover:bg-blue/85 md:h-auto"
              onClick={onSave}
            >
              Attach<span className="hidden md:inline">&nbsp;Recipe</span>
            </Button>
            {onDelete && (
              <Button
                variant="outlineRed"
                onClick={onDelete}
                className="h-11 whitespace-nowrap md:h-auto"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* ndZ9 — inspiration removed from the creator; the freed space lets the
          slots + notes use the full width (luPYg). zfnUz — borders thinned to
          cyan/20 across the editor sections. */}
      <Panel label="SLOTS" cornerTicks className="flex flex-col gap-2 p-3 md:gap-3 md:p-4">
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
      <Panel label="NOTES" className="p-3 md:p-4">
        <textarea
          value={recipe.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          aria-label="Recipe notes"
          rows={5}
          placeholder="Master your recipe with added techniques, notes, and ideas…"
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
      <ShareCardComposer
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        recipeName={recipe.name}
        slots={recipe.slots}
        initialNotes={recipe.notes ?? null}
        projectId={recipe.assignedProjectId ?? null}
        recipeId={recipe.id === "new" ? null : recipe.id}
      />
    </div>
  );
}
