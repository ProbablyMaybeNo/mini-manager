"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/kit";
import { cn } from "@/lib/cn";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { publishRecipe } from "@/lib/actions/recipeSharing";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import type { Paint, Project, Recipe, RecipeSlot } from "@/lib/types";
import { RecipePaintPicker } from "./RecipePaintPicker";
import { SlotRow } from "./SlotRow";

type RecipeTab = "MY RECIPES" | "GALLERY" | "SHARED";

/**
 * Recipes 3-pane workbench (Figma 28:4) — the column-based master-detail:
 *   recipe LIST (search + cards + tabs)  →  recipe DETAIL (28:4 editor-pane).
 * Selecting a list card populates the detail column in place (no navigation).
 * Clicking a step's paint dot opens the Pick & Paint panel (37:5) to fill that
 * slot. Persists the selected recipe via saveRecipe.
 */
export function RecipeWorkbench({
  recipes: initialRecipes,
  projects,
}: {
  recipes: Recipe[];
  projects: Project[];
}) {
  const router = useRouter();
  const { toast, node: toastNode } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [selectedId, setSelectedId] = useState<string | null>(initialRecipes[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RecipeTab>("MY RECIPES");
  // <768px drill-down (UX-001): the 3-pane master-detail collapses to a single
  // view on phones. `mobileDetail` flips to the detail pane when a recipe row is
  // tapped; the in-pane ‹ BACK control returns to the list. ≥md both panes show
  // side-by-side as before, so this state is inert on desktop.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [paints, setPaints] = useState<Paint[]>([]);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    loadKitCatalog()
      .then((p) => alive && setPaints(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const selected = recipes.find((r) => r.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, query]);

  /** How many of the user's projects this recipe is attached to (real count).
   *  The view-model carries a single attachedProjectId, so this is 0 or 1. */
  function usedInCount(recipe: Recipe): number {
    return recipe.assignedProjectId &&
      projects.some((p) => p.id === recipe.assignedProjectId)
      ? 1
      : 0;
  }

  function patchSelected(patch: Partial<Recipe>) {
    if (!selected) return;
    setRecipes((rs) => rs.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)));
  }

  function updateSlots(slots: RecipeSlot[]) {
    patchSelected({ slots });
  }

  function addSlot() {
    if (!selected) return;
    const blank: RecipeSlot = {
      paintId: "",
      swatch: "#1c2e44",
      brand: "—",
      name: "Pick a paint",
      layer: "",
      note: "",
    };
    updateSlots([...selected.slots, blank]);
    setPickingSlot(selected.slots.length);
  }

  function applySelection(sel: ColorPickerSelection) {
    if (!selected || pickingSlot == null) return;
    const meta = sel.paintId ? paints.find((p) => p.id === sel.paintId) ?? null : null;
    const slots = selected.slots.map((s, i) =>
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
    if (!selected) return;
    const j = i + dir;
    if (j < 0 || j >= selected.slots.length) return;
    const slots = [...selected.slots];
    [slots[i], slots[j]] = [slots[j], slots[i]];
    updateSlots(slots);
  }

  function persist() {
    if (!selected) return;
    startTransition(async () => {
      const res = await saveRecipe({
        id: selected.id === "new" ? null : selected.id,
        name: selected.name,
        attachedProjectId: selected.assignedProjectId ?? null,
        slots: selected.slots.map((s) => ({
          paintId: s.paintId || null,
          hex: s.swatch,
          layer: s.layer,
        })),
        inspo: selected.inspo.map((r) => r.url),
      });
      if (res.ok) {
        toast("Recipe saved", "green");
        router.refresh();
      } else {
        toast(res.error, "red");
      }
    });
  }

  function share() {
    if (!selected || selected.id === "new") {
      toast("Save the recipe before sharing.", "red");
      return;
    }
    startTransition(async () => {
      const res = await publishRecipe({ recipeId: selected.id });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      const url = `${window.location.origin}/r/${res.data.slug}`;
      void navigator.clipboard?.writeText(url);
      toast("Public link copied to clipboard", "green");
    });
  }

  const editing = selected && pickingSlot != null ? selected.slots[pickingSlot] : null;

  return (
    <div className="flex h-full bg-bg">
      {/* ── LIST column (28:42) — 320px, its own right hairline. On phones it is
          the default full-width view; tapping a recipe swaps to the detail pane
          (UX-001), so the list hides < md when mobileDetail is on. ─────────── */}
      <div
        className={cn(
          "flex-col border-r border-border md:flex md:w-[320px] md:shrink-0",
          mobileDetail ? "hidden w-full" : "flex w-full",
        )}
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-3">
              <span className="font-mono text-[20px] font-bold uppercase tracking-tight text-fg-bright">
                RECIPES
              </span>
              <span className="inline-flex items-center rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg-dim">
                {recipes.length}
              </span>
            </h1>
            <button
              type="button"
              onClick={() => router.push("/recipes/new")}
              // ≥44px tap target on touch widths, compact on desktop (UX-011).
              className="inline-flex min-h-[44px] items-center rounded-[6px] bg-cyan px-3 py-1.5 font-mono text-[12px] font-bold uppercase text-bg transition-colors hover:bg-cyan/85 md:min-h-0"
            >
              + NEW
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-[6px] border border-border bg-surface px-3 py-2">
            <span aria-hidden className="text-fg-dim">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH RECIPES..."
              aria-label="Search recipes"
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] uppercase text-fg placeholder:text-[#757575] focus:outline-none"
            />
          </label>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
          {filtered.length > 0 ? (
            filtered.map((r) => {
              const isSel = r.id === selectedId;
              return (
                <li key={r.id} className="px-0 py-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(r.id);
                      setPickingSlot(null);
                      setMobileDetail(true);
                    }}
                    aria-current={isSel ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[8px] p-3 text-left transition-colors",
                      isSel
                        ? "border border-cyan bg-cyan/[0.06]"
                        : "border border-transparent hover:bg-cyan/[0.04]",
                    )}
                  >
                    {/* Vertical swatch strip (28:56) — up to 5 of the recipe's hexes. */}
                    <span className="flex w-[18px] shrink-0 flex-col gap-0.5">
                      {(r.slots.length > 0
                        ? r.slots.slice(0, 5)
                        : [{ swatch: "#2a2a30" } as RecipeSlot]
                      ).map((s, i) => (
                        <span
                          key={i}
                          className="h-2.5 w-[18px] rounded-[2px]"
                          style={{ backgroundColor: s.swatch }}
                          aria-hidden
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate font-mono text-[13px] font-bold",
                          isSel ? "text-cyan" : "text-fg-bright",
                        )}
                      >
                        {r.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-fg-dim">
                        Used in {usedInCount(r)} project{usedInCount(r) === 1 ? "" : "s"} ·{" "}
                        {r.slots.length} step{r.slots.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-6 font-mono text-[12px] text-fg-dim">
              {recipes.length === 0 ? "No recipes yet." : `No recipes match “${query}”.`}
            </li>
          )}
        </ul>

        {/* Bottom tabs (28:126). */}
        <div role="tablist" aria-label="Recipe source" className="flex items-center gap-5 border-t border-border px-4 py-3">
          {(["MY RECIPES", "GALLERY", "SHARED"] as RecipeTab[]).map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t)}
                className={cn(
                  // Padded ≥44px tap target on touch widths; stays compact on
                  // desktop via md: overrides (UX-011).
                  "inline-flex min-h-[44px] items-center border-b-2 px-1 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:text-cyan md:min-h-0 md:px-0 md:pb-0.5",
                  active
                    ? "border-cyan text-cyan"
                    : "border-transparent text-fg-dim hover:text-fg",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DETAIL column (28:131) — the 28:4 editor-pane. On phones it is the
          drilled-in view (hidden until a recipe is tapped), with a ‹ BACK
          control to return to the list (UX-001). ─────────────────────────── */}
      <div
        className={cn(
          "min-w-0 flex-1 flex-col overflow-y-auto md:flex",
          mobileDetail ? "flex" : "hidden",
        )}
      >
        {selected ? (
          <div className="flex max-w-[760px] flex-col gap-6 p-8">
            {/* Phone-only back control returning to the recipe list (UX-001). */}
            <button
              type="button"
              onClick={() => setMobileDetail(false)}
              className="-mb-2 inline-flex min-h-[44px] w-fit items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-wide text-fg-dim transition-colors hover:text-cyan md:hidden"
            >
              <span aria-hidden>‹</span> Recipes
            </button>
            {/* Editor header (28:132). */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <input
                    value={selected.name}
                    onChange={(e) => patchSelected({ name: e.target.value })}
                    aria-label="Recipe name"
                    className="bg-transparent font-mono text-[28px] font-extrabold uppercase leading-none text-fg-bright focus:outline-none"
                  />
                  <span className="h-0.5 w-full bg-cyan/30" aria-hidden />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={share}
                    className="inline-flex items-center rounded-[6px] border border-border px-4 py-2.5 font-mono text-[12px] font-bold text-fg-bright transition-colors hover:border-cyan/50 hover:text-cyan"
                  >
                    ⬡ SHARE LINK
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/recipes?ai=1")}
                    className="inline-flex items-center gap-2 rounded-[6px] border border-orange bg-surface px-4 py-2.5 font-mono text-[12px] font-bold text-fg-bright transition-colors hover:bg-orange/10"
                  >
                    ⚡ AI GENERATE
                    <span className="rounded-[2px] bg-orange px-1 py-px font-mono text-[8px] font-extrabold text-bg">
                      PRO
                    </span>
                  </button>
                </div>
              </div>

              {/* Scheme swatch strip (37:405) — 32px squares of the recipe palette. */}
              {selected.slots.length > 0 && (
                <div className="flex items-center gap-0">
                  {selected.slots.slice(0, 8).map((s, i) => (
                    <span
                      key={i}
                      className="h-8 w-8 rounded-[2px]"
                      style={{ backgroundColor: s.swatch }}
                      aria-hidden
                    />
                  ))}
                </div>
              )}

              {/* Meta line (28:151). */}
              <p className="font-mono text-[12px] uppercase text-fg-dim">
                {selected.slots.length} step{selected.slots.length === 1 ? "" : "s"}
                {selected.assignedProjectId
                  ? ` · USED IN: ${
                      projects.find((p) => p.id === selected.assignedProjectId)?.title ?? "1 project"
                    }`
                  : ""}
              </p>
            </div>

            {/* Step rows (28:153). */}
            <div className="flex flex-col gap-3">
              {selected.slots.length === 0 ? (
                <p className="rounded-[6px] border border-dashed border-border px-4 py-8 text-center font-mono text-[12px] text-fg-dim">
                  No steps yet — add your first paint step below.
                </p>
              ) : (
                selected.slots.map((slot, i) => (
                  <SlotRow
                    key={i}
                    slot={slot}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === selected.slots.length - 1}
                    onPick={() => setPickingSlot(i)}
                    onRemove={() => updateSlots(selected.slots.filter((_, k) => k !== i))}
                    onMove={(dir) => moveSlot(i, dir)}
                    onLayerChange={(layer) =>
                      updateSlots(selected.slots.map((s, k) => (k === i ? { ...s, layer } : s)))
                    }
                    onNoteChange={(note) =>
                      updateSlots(selected.slots.map((s, k) => (k === i ? { ...s, note } : s)))
                    }
                  />
                ))
              )}

              {/* + ADD STEP (28:237). */}
              <button
                type="button"
                onClick={addSlot}
                className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-cyan/40 py-3 font-mono text-[13px] font-bold uppercase tracking-wide text-cyan transition-colors hover:bg-cyan/5"
              >
                + ADD STEP
              </button>
            </div>

            {/* Footer actions (37:409 / 28:49). */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={persist}
                className="inline-flex items-center rounded-[6px] bg-green px-4 py-2 font-mono text-[12px] font-bold uppercase text-bg transition-colors hover:bg-green/85"
              >
                SAVE RECIPE
              </button>
              <button
                type="button"
                onClick={persist}
                className="inline-flex items-center rounded-[6px] bg-blue px-4 py-2 font-mono text-[12px] font-bold uppercase text-bg transition-colors hover:bg-blue/85"
              >
                ATTACH RECIPE
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="font-mono text-[13px] text-fg-dim">
              Select a recipe from the list, or create a new one.
            </p>
          </div>
        )}
      </div>

      {/* Pick & Paint panel (37:5) — opens on a step's paint dot, fills the slot. */}
      <RecipePaintPicker
        open={pickingSlot != null}
        onClose={() => setPickingSlot(null)}
        onSelect={applySelection}
        contextLabel={pickingSlot != null ? `Slot ${pickingSlot + 1}` : undefined}
        mode={editing && editing.paintId ? "edit-slot" : "add-slot"}
        initialHex={editing?.swatch ?? null}
        initialPaintId={editing?.paintId || null}
      />
      {toastNode}
    </div>
  );
}
