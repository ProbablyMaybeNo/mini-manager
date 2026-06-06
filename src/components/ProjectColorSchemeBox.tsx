"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RecipeTabs, type RecipeTab } from "@/components/focus/RecipeTabs";
import {
  AttachRecipeModal,
  type RecipeOption,
} from "@/components/recipes/AttachRecipeModal";
import { addSlot, deleteSlot, updateSlot } from "@/lib/actions/recipeSlots";
import type {
  ColorPickerMode,
  ColorPickerSelection,
} from "@/lib/colorPicker/types";

export interface ColorSchemeSlot {
  /** Recipe-slot id. Used to call updateSlot/deleteSlot when the painter
   *  clicks a filled box. */
  slotId: string;
  /** Resolved hex (the slot's customColorHex or the catalog hex for its
   *  paintId). Null when the slot has no colour resolved. */
  hex: string | null;
  /** User-facing slot label (paint name, or "Slot N"). */
  name: string;
}

interface Props {
  projectId: string;
  projectName: string;
  /** Attached recipe id + name. Null when no recipe is attached. */
  attachedRecipeId: string | null;
  attachedRecipeName: string | null;
  /** Existing slots in zone-position order. Empty when none. */
  slots: ReadonlyArray<ColorSchemeSlot>;
  /** UX-907 — Every recipe attached to this project (most-recently-
   *  updated first). When length >= 2 we render the RecipeTabs strip
   *  above the swatch row so the painter can switch between recipes
   *  without leaving the leaf workspace; the active tab is the
   *  `attachedRecipeId` chosen by the page. */
  attachedRecipes?: ReadonlyArray<RecipeTab>;
  /** UX-904 — Recipes the user owns that are NOT yet attached here.
   *  Powers the AttachRecipeModal "Pick existing" tab so clicking the
   *  + ghost on an empty scheme opens the same modal as /projects → +.
   *  Default [] keeps the prop optional for older call sites. */
  attachCandidates?: ReadonlyArray<RecipeOption>;
}

/**
 * Project detail "Recipe" box (2026-06-04 unify — the project-side
 * "colour scheme" is just a Recipe rendered in the project workspace).
 *
 * Renders a horizontal row of slot swatches:
 *   - When an attached recipe exists, fills the boxes with its slot
 *     palette and shows the recipe name above.
 *   - When no recipe is attached, shows 3 empty `+` starter boxes that
 *     open the AttachRecipeModal (pick existing / create new).
 *   - The trailing add-paint button always renders (when a recipe
 *     exists) to append a slot.
 *
 * Clicking any box opens the ColorPicker side panel:
 *   - empty + → addSlot (paints-only)
 *   - filled  → updateSlot (swap the paint)
 *
 * The same flat slot model as the recipe editor — only the host context
 * differs.
 */
export function ProjectColorSchemeBox({
  projectId,
  projectName: _projectName,
  attachedRecipeId,
  attachedRecipeName,
  slots,
  attachedRecipes = [],
  attachCandidates = [],
}: Props) {
  const router = useRouter();
  const [pickerTarget, setPickerTarget] = useState<
    { kind: "new" } | { kind: "edit"; slotIndex: number } | null
  >(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  // UX-904 — When no recipe is attached, the + ghost opens the unified
  // AttachRecipeModal (same modal as /projects → + ATTACH). Previously
  // the + immediately created a "<projectName> scheme" recipe with no
  // chance to pick an existing one, which dropped the painter into a
  // fresh empty editor even when they already owned a perfect recipe.
  const [attachOpen, setAttachOpen] = useState(false);

  const handlePickerSelect = (selection: ColorPickerSelection) => {
    setPickerError(null);
    if (!attachedRecipeId) {
      setPickerError("Attach or create a recipe before picking colours.");
      return;
    }
    // Paints-only: a slot must be backed by a catalog paint. Raw-hex
    // selections (wheel / eyedropper) are rejected on the ADD/SWAP path.
    if (!selection.paintId) {
      setPickerError("Pick a paint from the library to fill this slot.");
      return;
    }
    const paintId = selection.paintId;
    startSaveTransition(async () => {
      if (pickerTarget?.kind === "new") {
        const result = await addSlot({
          recipeId: attachedRecipeId,
          paintId,
        });
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setPickerTarget(null);
        router.refresh();
      } else if (pickerTarget?.kind === "edit") {
        const slot = slots[pickerTarget.slotIndex];
        if (!slot) {
          setPickerError("This slot no longer exists.");
          return;
        }
        const result = await updateSlot({ id: slot.slotId, paintId });
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setPickerTarget(null);
        router.refresh();
      }
    });
  };

  const handleDeleteSlot = (slotId: string, name: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove "${name}" from this recipe?`)
    ) {
      return;
    }
    startSaveTransition(async () => {
      const result = await deleteSlot({ id: slotId });
      if (!result.ok) setPickerError(result.error);
      else router.refresh();
    });
  };

  const initialHex =
    pickerTarget?.kind === "edit"
      ? slots[pickerTarget.slotIndex]?.hex ?? null
      : null;

  // When no recipe attached and no painter clicks yet, show 3 starter
  // ghost boxes (Ross's brief). They're informational — clicking
  // creates the recipe first then opens the picker.
  const displayBoxes: ReadonlyArray<
    ColorSchemeSlot | { ghost: true; key: string }
  > = attachedRecipeId
    ? slots
    : Array.from({ length: 3 }, (_, i) => ({ ghost: true, key: `g${i}` }));

  return (
    <>
      <Card
        title={
          attachedRecipeName ? `Recipe · ${attachedRecipeName}` : "Recipe"
        }
        accentColor="cyan"
        ticks
        techLabel="OPS ▸ RECIPE"
      >
        <div className="space-y-3">
          {/* UX-907 — When 2+ recipes attached, surface the recipe-picker
              affordance as a tab strip. RecipeTabs is a noop for < 2. */}
          {attachedRecipeId && attachedRecipes.length >= 2 ? (
            <RecipeTabs
              recipes={attachedRecipes}
              activeId={attachedRecipeId}
              paramKey="recipe"
              label="Attached recipes"
            />
          ) : null}
          {!attachedRecipeId ? (
            <p className="text-xs font-sans text-[var(--color-fg-subtle)] leading-snug">
              Click a{" "}
              <span className="font-mono uppercase tracking-wider">+</span>{" "}
              box to start a recipe for this project — the boxes fill in
              with the picked paints.
            </p>
          ) : null}
          <div
            className="flex flex-wrap items-center gap-2"
            role="list"
            aria-label="Recipe swatches"
          >
            {displayBoxes.map((box, idx) =>
              "ghost" in box ? (
                <GhostBox
                  key={box.key}
                  onClick={
                    attachedRecipeId
                      ? () => setPickerTarget({ kind: "new" })
                      : () => setAttachOpen(true)
                  }
                  disabled={isSaving}
                />
              ) : (
                <FilledBox
                  key={box.slotId}
                  hex={box.hex}
                  name={box.name}
                  onSelect={() => setPickerTarget({ kind: "edit", slotIndex: idx })}
                  onDelete={() => handleDeleteSlot(box.slotId, box.name)}
                />
              ),
            )}
            {attachedRecipeId ? (
              <Button
                type="button"
                variant="success"
                size="sm"
                onClick={() => setPickerTarget({ kind: "new" })}
                disabled={isSaving}
              >
                + Add paint
              </Button>
            ) : null}
          </div>
          {pickerError ? (
            <p
              role="alert"
              className="text-2xs font-mono text-[var(--color-red)]"
            >
              {pickerError}
            </p>
          ) : null}
        </div>
      </Card>

      {pickerTarget ? (
        <ColorPickerSidePanel
          contextLabel={
            pickerTarget.kind === "new"
              ? "Add a paint to this recipe"
              : `Swap slot · ${slots[pickerTarget.slotIndex]?.name ?? ""}`
          }
          mode={pickerTarget.kind === "new" ? "add-slot" : "edit-slot"}
          initialHex={initialHex}
          busy={isSaving}
          error={pickerError}
          onClose={() => {
            setPickerTarget(null);
            setPickerError(null);
          }}
          onSelect={handlePickerSelect}
        />
      ) : null}

      {/* UX-904 — Unified attach-recipe modal. Opens from the + ghost
          when no recipe is attached yet. Same modal the /projects
          dashboard row uses, so both surfaces expose the painter's
          "pick existing OR create new" choice identically. */}
      <AttachRecipeModal
        mode="project"
        projectId={projectId}
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        candidates={attachCandidates}
      />
    </>
  );
}

function GhostBox({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Add a paint to the recipe"
      className="w-14 h-14 flex items-center justify-center rounded-sm text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] transition-colors disabled:opacity-50 cursor-pointer"
      style={{ border: "2px dashed var(--color-border-strong)" }}
    >
      <span aria-hidden className="font-mono text-2xl leading-none">
        +
      </span>
    </button>
  );
}

function FilledBox({
  hex,
  name,
  onSelect,
  onDelete,
}: {
  hex: string | null;
  name: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group" role="listitem">
      <button
        type="button"
        onClick={onSelect}
        title={`${name}${hex ? ` · ${hex}` : ""} — click to swap`}
        aria-label={`Swap paint for ${name}`}
        className="w-14 h-14 rounded-sm cursor-pointer hover:outline hover:outline-2 hover:outline-[var(--color-cyan)]"
        style={{
          background: hex ?? "transparent",
          border: "2px solid var(--color-border-strong)",
        }}
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${name}`}
        className="absolute top-0 right-0 px-1 text-2xs font-mono leading-none opacity-0 group-hover:opacity-100 hover:text-[var(--color-red)] cursor-pointer"
        style={{
          color: "var(--color-fg)",
          background: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
        }}
      >
        ×
      </button>
    </div>
  );
}

function ColorPickerSidePanel({
  contextLabel,
  mode,
  initialHex,
  busy,
  error,
  onClose,
  onSelect,
}: {
  contextLabel: string;
  mode: ColorPickerMode;
  initialHex: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={contextLabel}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="flex-1 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
      />
      {/* UX-1216 — bottom sheet on mobile, right-side drawer on desktop
          (mirrors the recipe ZoneList picker for a consistent feel). */}
      <aside
        className="w-full max-h-[88vh] md:max-h-none md:w-[480px] md:h-full bg-[var(--color-bg-elevated)] flex flex-col border-t border-[var(--color-border-strong)] md:border-t-0 md:border-l md:border-[var(--color-border-strong)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <header
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="font-mono text-xs uppercase tracking-wider">
            {contextLabel}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto">
          <ColorPicker
            value={initialHex ? { hex: initialHex } : null}
            onSelect={onSelect}
            mode={mode}
          />
        </div>
        {error ? (
          <p
            role="alert"
            className="m-3 frame px-3 py-2 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
          >
            {error}
          </p>
        ) : null}
        {busy ? (
          <p className="m-3 text-2xs font-mono text-[var(--color-fg-muted)] text-center">
            Saving…
          </p>
        ) : null}
      </aside>
    </div>
  );
}
