"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  addSlotWithPaint,
  deleteZone,
} from "@/lib/actions/recipeZones";
import { updateStep } from "@/lib/actions/recipeSteps";
import { createRecipe } from "@/lib/actions/recipes";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";

export interface ColorSchemeSlot {
  /** Recipe-zone id for this slot. Used to call updateStep when the
   *  painter clicks a filled box. */
  zoneId: string;
  /** First-step id of the slot — the step the picker swaps. */
  firstStepId: string | null;
  /** Resolved hex (either the step's customColorHex or the catalog
   *  hex for paintId). Null when the slot has no first step yet. */
  hex: string | null;
  /** User-facing slot name (e.g. "Slot 1"). */
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
}

/**
 * P12.9 — Project detail "Color Scheme" box.
 *
 * Renders a horizontal row of swatches:
 *   - When an attached recipe exists, fills the boxes with its
 *     palette and shows the recipe name above.
 *   - When no recipe is attached, shows 3 empty `+` starter boxes
 *     and a "Create recipe" CTA so the painter can spin up one
 *     inline.
 *   - The trailing "+ Add paint" button always renders (when a
 *     recipe exists) to extend the slot row.
 *
 * Clicking any box opens the ColorPicker side panel:
 *   - empty + → addSlotWithPaint
 *   - filled  → updateStep on the slot's first step
 *
 * The same primitive used by the recipe editor (P12.2) — the slot
 * picker UI is unchanged; only the host context is different.
 */
export function ProjectColorSchemeBox({
  projectId,
  projectName,
  attachedRecipeId,
  attachedRecipeName,
  slots,
}: Props) {
  const router = useRouter();
  const [pickerTarget, setPickerTarget] = useState<
    { kind: "new" } | { kind: "edit"; slotIndex: number } | null
  >(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  // Without an attached recipe, clicking + creates a fresh recipe
  // first (named after the project) + attaches it + opens the picker
  // again so the first slot can be added. Keeps the painter's two-
  // click "I want a scheme" intent flowing.
  const handleCreateRecipeAndOpenPicker = () => {
    setPickerError(null);
    startSaveTransition(async () => {
      const result = await createRecipe({
        name: `${projectName} scheme`,
        attachedProjectId: projectId,
      });
      if (!result.ok) {
        setPickerError(result.error);
        return;
      }
      // Server-side revalidation will refresh; close the picker so
      // the new attached state lands.
      router.refresh();
    });
  };

  const handlePickerSelect = (selection: ColorPickerSelection) => {
    setPickerError(null);
    if (!attachedRecipeId) {
      setPickerError("Attach or create a recipe before picking colours.");
      return;
    }
    startSaveTransition(async () => {
      if (pickerTarget?.kind === "new") {
        const result = await addSlotWithPaint({
          recipeId: attachedRecipeId,
          paintId: selection.paintId ?? null,
          customColorHex: selection.paintId ? null : selection.hex,
        });
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setPickerTarget(null);
        router.refresh();
      } else if (pickerTarget?.kind === "edit") {
        const slot = slots[pickerTarget.slotIndex];
        if (!slot?.firstStepId) {
          setPickerError("This slot has no step to update.");
          return;
        }
        const result = await updateStep({
          id: slot.firstStepId,
          paintId: selection.paintId ?? null,
          customColorHex: selection.paintId ? null : selection.hex,
        });
        if (!result.ok) {
          setPickerError(result.error);
          return;
        }
        setPickerTarget(null);
        router.refresh();
      }
    });
  };

  const handleDeleteSlot = (zoneId: string, name: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove "${name}" from this scheme?`)
    ) {
      return;
    }
    startSaveTransition(async () => {
      const result = await deleteZone({ id: zoneId });
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
          attachedRecipeName
            ? `Color scheme · ${attachedRecipeName}`
            : "Color scheme"
        }
        accentColor="cyan"
      >
        <div className="space-y-3">
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
            aria-label="Color scheme swatches"
          >
            {displayBoxes.map((box, idx) =>
              "ghost" in box ? (
                <GhostBox
                  key={box.key}
                  onClick={
                    attachedRecipeId
                      ? () => setPickerTarget({ kind: "new" })
                      : handleCreateRecipeAndOpenPicker
                  }
                  disabled={isSaving}
                />
              ) : (
                <FilledBox
                  key={box.zoneId}
                  hex={box.hex}
                  name={box.name}
                  onSelect={() => setPickerTarget({ kind: "edit", slotIndex: idx })}
                  onDelete={() => handleDeleteSlot(box.zoneId, box.name)}
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
              ? "Add a colour to this scheme"
              : `Swap slot · ${slots[pickerTarget.slotIndex]?.name ?? ""}`
          }
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
      aria-label="Add a colour to the scheme"
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
  initialHex,
  busy,
  error,
  onClose,
  onSelect,
}: {
  contextLabel: string;
  initialHex: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (selection: ColorPickerSelection) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={contextLabel}
    >
      <div
        aria-hidden
        onClick={onClose}
        className="flex-1 bg-[color-mix(in_srgb,var(--color-bg)_70%,transparent)]"
      />
      <aside
        className="w-full md:w-[480px] h-full bg-[var(--color-bg-elevated)] flex flex-col"
        style={{ borderLeft: "1px solid var(--color-border-strong)" }}
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
