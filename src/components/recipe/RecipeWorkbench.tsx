"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ModalDialog, useToast } from "@/components/kit";
import { cn } from "@/lib/cn";
import { copyText } from "@/lib/clipboard";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { deleteRecipe } from "@/lib/actions/recipes";
import { publishRecipe } from "@/lib/actions/recipeSharing";
import { createWishlistItem } from "@/lib/actions/wishlist";
import type { ColorPickerSelection } from "@/lib/colorPicker/types";
import type { GroundedRecipeProposal } from "@/lib/ai/recipeSchema";
import type { Paint, Project, Recipe, RecipeSlot } from "@/lib/types";
import { AiRecipeDialog } from "./AiRecipeDialog";
import { RecipePaintPicker } from "./RecipePaintPicker";
import { ShareCardComposer } from "./ShareCardComposer";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { SlotRow } from "./SlotRow";

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
  // <768px drill-down (UX-001): the 3-pane master-detail collapses to a single
  // view on phones. `mobileDetail` flips to the detail pane when a recipe row is
  // tapped; the in-pane ‹ BACK control returns to the list. ≥md both panes show
  // side-by-side as before, so this state is inert on desktop.
  const [mobileDetail, setMobileDetail] = useState(false);
  const [paints, setPaints] = useState<Paint[]>([]);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

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
        notesMd: selected.notes ?? null,
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
      // The URL is revealed in a persistent, copyable field so it's never
      // clipboard-only (UX-004) — set it FIRST so it's already on screen when
      // the write is blocked, then report the write honestly (R2-1).
      setShareUrl(url);
      void copyText(url, toast, {
        copied: "Public link copied to clipboard",
        failed: "Couldn’t copy automatically — the link is below, copy it by hand.",
      });
    });
  }

  function remove() {
    if (!selected) return;
    startTransition(async () => {
      const res = await deleteRecipe({ id: selected.id });
      if (res.ok) {
        setConfirmingDelete(false);
        setRecipes((rs) => rs.filter((r) => r.id !== selected.id));
        setSelectedId(null);
        setMobileDetail(false);
        toast("Recipe deleted", "green");
        router.push("/recipes");
        router.refresh();
      } else {
        toast(res.error, "red");
      }
    });
  }

  /** AI creator "Approve" → build a real recipe from the grounded proposal
   *  (catalog paints + technique notes) and persist it via the same action the
   *  editor uses, then refresh so it appears in the list. */
  async function approveAiRecipe(proposal: GroundedRecipeProposal) {
    const name = proposal.summary?.trim().slice(0, 60) || "AI recipe";
    const res = await saveRecipe({
      id: null,
      name,
      attachedProjectId: null,
      slots: proposal.slots.map((s) => ({
        paintId: s.paintId || null,
        hex: s.hex,
        layer: s.layer,
      })),
      inspo: [],
      notesMd: proposal.techniqueNotes || null,
    });
    if (res.ok) {
      setAiOpen(false);
      toast("AI recipe saved", "green");
      router.refresh();
    } else {
      toast(res.error, "red");
    }
  }

  /** AI creator "+ Wishlist missing" → add each not-owned catalog paint to the
   *  collection wishlist (looked up from the loaded catalog for its name). */
  async function addMissingToWishlist(paintIds: string[]) {
    for (const id of paintIds) {
      const p = paints.find((x) => x.id === id);
      if (!p) continue;
      await createWishlistItem({ title: p.name, company: p.brand });
    }
    router.refresh();
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
        <div className="flex flex-col gap-4 p-3 md:gap-5 md:p-6">
          <div className="flex items-center justify-between">
            {/* Count badge lives OUTSIDE the <h1> so the heading's accessible
                name reads "RECIPES", not "RECIPES0" (UX-008); the badge carries
                its own spoken label. */}
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-[20px] font-bold uppercase tracking-tight text-fg-bright">
                RECIPES
              </h1>
              <span
                aria-label={`${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`}
                className="inline-flex items-center rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-fg-dim"
              >
                {recipes.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Plain-language "what is a recipe / how do I build one" explainer
                  for first-timers who land on an empty recipe list (DOP-006). */}
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                aria-label="What is a recipe?"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 font-mono text-[12px] font-bold uppercase text-fg-dim transition-colors hover:border-cyan/50 hover:text-cyan-lite md:min-h-0"
              >
                <span aria-hidden>ⓘ</span> LOST?
              </button>
              <button
                type="button"
                onClick={() => router.push("/recipes/new")}
                // ≥44px tap target on touch widths, compact on desktop (UX-011).
                className="inline-flex min-h-[44px] items-center rounded-[6px] bg-cyan px-3 py-1.5 font-mono text-[12px] font-bold uppercase text-bg transition-colors hover:bg-cyan/85 md:min-h-0"
              >
                + NEW
              </button>
            </div>
          </div>
          {/* Blue intro banner matching the project page's WelcomeCard slim bar
              (same #22568F navy + white mono "> SYS —" prefix) so the recipes
              page reads as the same family. Wraps (rather than truncates) in
              the narrow 320px column. Desktop only — on a phone this column IS
              the whole page, and a strapline shouldn't outrank the recipe list
              (Ross, 2026-07-27). */}
          <section
            className="hidden rounded-[10px] px-3 py-2 text-white roomy:block"
            style={{ backgroundColor: "#22568F" }}
          >
            <span className="block font-mono text-[12px] leading-snug text-white">
              <span className="font-bold">&gt; SYS</span> — build &amp; share repeatable
              paint schemes.
            </span>
          </section>
          {/* Hidden until there's enough to search (MUX-025) — a search box over
              a single recipe is a control that can only ever hide the one thing
              on screen. */}
          <label
            className={cn(
              "items-center gap-2 rounded-[6px] border border-border bg-surface px-3 py-2",
              recipes.length >= 6 ? "flex" : "hidden",
            )}
          >
            <span aria-hidden className="text-fg-dim">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH RECIPES..."
              aria-label="Search recipes"
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] uppercase text-fg placeholder:text-fg-muted focus:outline-none"
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
                          isSel ? "text-cyan-lite" : "text-fg-bright",
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
          <div className="flex w-full flex-col gap-6 p-8 xl:max-w-[1200px]">
            {/* Phone-only back control returning to the recipe list (UX-001). */}
            <button
              type="button"
              onClick={() => setMobileDetail(false)}
              className="-mb-2 inline-flex min-h-[44px] w-fit items-center gap-1.5 font-mono text-[12px] font-bold uppercase tracking-wide text-fg-dim transition-colors hover:text-cyan-lite md:hidden"
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
                    className="inline-flex items-center rounded-[6px] border border-border px-4 py-2.5 font-mono text-[12px] font-bold text-fg-bright transition-colors hover:border-cyan/50 hover:text-cyan-lite"
                  >
                    ⬡ SHARE LINK
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareCardOpen(true)}
                    className="inline-flex items-center rounded-[6px] border border-cyan/50 px-4 py-2.5 font-mono text-[12px] font-bold text-cyan-lite transition-colors hover:border-cyan hover:bg-cyan/10"
                  >
                    ⬡ SHARE AS CARD
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiOpen(true)}
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

              {/* + ADD PAINT (28:237). */}
              <button
                type="button"
                onClick={addSlot}
                className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-cyan/40 py-3 font-mono text-[13px] font-bold uppercase tracking-wide text-cyan-lite transition-colors hover:bg-cyan/5"
              >
                + ADD PAINT
              </button>
            </div>

            {/* Footer actions (37:409 / 28:49) — DELETE sits apart on the left so
                it never crowds the primary SAVE / ATTACH pair. */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center rounded-[6px] border border-red/60 px-4 py-2 font-mono text-[12px] font-bold uppercase text-red transition-colors hover:border-red hover:bg-red/10"
              >
                DELETE
              </button>
              <div className="flex items-center gap-3">
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

            {/* NOTES — recipe-level notes (recipes.notesMd), persisted via the
                same SAVE RECIPE action as the rest of the recipe. */}
            <div className="flex flex-col gap-2 rounded-[6px] border border-border bg-surface p-4">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-fg-dim">
                Notes
              </span>
              <textarea
                value={selected.notes ?? ""}
                onChange={(e) => patchSelected({ notes: e.target.value })}
                aria-label="Recipe notes"
                rows={5}
                placeholder="Master your recipe with added techniques, notes, and ideas…"
                className="w-full resize-y rounded-[6px] border border-border bg-bg p-3 font-mono text-[13px] text-fg placeholder:text-fg-muted focus:border-cyan focus:outline-none"
              />
            </div>
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex flex-col gap-1.5">
              <p className="font-display text-[14px] font-bold uppercase tracking-wide text-fg">
                No recipes yet
              </p>
              <p className="max-w-xs font-mono text-[13px] leading-relaxed text-fg-dim">
                A recipe saves a paint sequence — base, layer, highlight — that you
                can reuse across projects.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/recipes/new")}
              className="inline-flex items-center rounded-[6px] bg-cyan px-4 py-2.5 font-display text-[12px] font-bold uppercase tracking-tight text-bg transition-colors hover:bg-cyan/85"
            >
              Create your first recipe
            </button>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="font-mono text-[13px] text-fg-dim">
              Select a recipe from the list to view it here.
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
      <ConfirmDialog
        open={confirmingDelete}
        breadcrumb="RECIPE"
        title="Delete recipe?"
        message={
          selected
            ? `“${selected.name}” and its ${selected.slots.length} paint step${
                selected.slots.length === 1 ? "" : "s"
              } will be permanently deleted. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={isPending}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={remove}
      />
      <ModalDialog
        open={showHelp}
        onClose={() => setShowHelp(false)}
        breadcrumb="RECIPES ▸ HELP"
        title="What's a recipe?"
        width="max-w-lg"
      >
        <div className="flex flex-col gap-4 font-mono text-[13px] leading-relaxed text-fg">
          <p>
            A <span className="text-cyan-lite">recipe</span> is a repeatable paint
            scheme — the ordered layers you apply to get a look — that you can
            reuse across projects instead of remembering it each time.
          </p>
          <div className="flex flex-col gap-2">
            <span className="label-osd text-cyan-lite">HOW TO BUILD ONE</span>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-fg-dim">
              <li>
                Hit <span className="text-fg-bright">+ NEW</span> and give the
                recipe a name.
              </li>
              <li>
                Add each paint as a step with{" "}
                <span className="text-fg-bright">ADD PAINT</span> — work bottom-up:
                undercoat first, then base, layers, and highlights last.
              </li>
              <li>
                Tag every step with its technique (basecoat, shade, layer,
                highlight…) and jot an optional note.
              </li>
              <li>
                <span className="text-fg-bright">SAVE RECIPE</span>, then{" "}
                <span className="text-fg-bright">ATTACH</span> it to a project so
                you can follow the same scheme every time you paint it.
              </li>
            </ol>
          </div>
          <p className="text-fg-dim">
            Tip: turn the colour wheel in the paint picker to surface the closest
            library paints, then ADD PAINT to lock one in.
          </p>
        </div>
      </ModalDialog>
      <ShareLinkDialog url={shareUrl} open={shareUrl != null} onClose={() => setShareUrl(null)} />
      {selected && (
        <ShareCardComposer
          open={shareCardOpen}
          onClose={() => setShareCardOpen(false)}
          recipeName={selected.name}
          slots={selected.slots}
          initialNotes={selected.notes ?? null}
          projectId={selected.assignedProjectId ?? null}
          recipeId={selected.id === "new" ? null : selected.id}
        />
      )}
      <AiRecipeDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApprove={approveAiRecipe}
        onAddMissing={addMissingToWishlist}
      />
      {toastNode}
    </div>
  );
}
