"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AiRecipeDialog } from "@/components/recipe/AiRecipeDialog";
import { RecipeEditorView } from "@/components/recipe/RecipeEditorView";
import { ShareLinkDialog } from "@/components/recipe/ShareLinkDialog";
import { ConfirmDialog, useToast } from "@/components/kit";
import type { GroundedRecipeProposal } from "@/lib/ai/recipeSchema";
import type { Paint, Project, Recipe } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import { guarded } from "@/lib/actionGuard";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { deleteRecipe } from "@/lib/actions/recipes";
import { publishRecipe } from "@/lib/actions/recipeSharing";
import { createWishlistItem } from "@/lib/actions/wishlist";
import {
  UNSAVED_CHANGES_MESSAGE,
  useUnsavedChangesGuard,
} from "@/lib/useUnsavedChangesGuard";

/** Stable signature of the editable recipe content, for dirty-checking. */
function recipeSignature(r: Recipe): string {
  return JSON.stringify({
    name: r.name,
    assignedProjectId: r.assignedProjectId ?? null,
    slots: r.slots.map((s) => ({
      paintId: s.paintId,
      swatch: s.swatch,
      layer: s.layer,
      note: s.note ?? null,
    })),
    inspo: r.inspo.map((i) => i.url),
    notes: r.notes ?? null,
  });
}

/**
 * Recipe editor controller. The recipe (real slots) + projects come from the
 * server; the paint catalog loads client-side for the slot picker. Save
 * persists the whole edited recipe via saveRecipe, then returns to the index.
 */
export function RecipeEditorClient({
  initial,
  projects,
  backTo,
}: {
  initial: Recipe;
  projects: Project[];
  /** When the recipe belongs to a project (attached, or created from it via
   *  ?from=), the back control returns to that project's dashboard panel and
   *  reads "‹ back to <title>". Absent → the plain "← Recipes" index return. */
  backTo?: { projectId: string; title: string };
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [recipe, setRecipe] = useState<Recipe>(initial);
  const [paints, setPaints] = useState<Paint[]>([]);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  // An unsaved "new" draft is dirty as soon as it has a name or any slots
  // (leaving would discard it); an existing recipe is dirty once edited.
  // `saved` disarms the guard for the post-save redirect.
  // Resolve a picked paint id → brand/name for the slot row. The shared
  // ColorPicker carries the id; the editor only needs the display labels.
  const resolvePaintMeta = (paintId: string) => {
    const p = paints.find((x) => x.id === paintId);
    return p ? { brand: p.brand, name: p.name } : null;
  };

  const isNew = recipe.id === "new";
  const hasContent = recipe.name.trim().length > 0 || recipe.slots.length > 0;
  const dirty =
    !saved &&
    (isNew ? hasContent : recipeSignature(recipe) !== recipeSignature(initial));
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    let alive = true;
    loadKitCatalog()
      .then((p) => {
        if (alive) setPaints(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function persist() {
    startTransition(async () => {
      // R2-9 — SAVE is the one control that must never destroy the thing it is
      // saving. This `await` used to be bare, so offline the rejection escaped
      // the transition into the route error boundary: the whole app became the
      // fault screen and every unsaved slot, layer label and note went with it.
      // A failed save now says so and leaves the editor exactly as it was, with
      // the unsaved-changes guard still armed and SAVE still there to press.
      const res = await guarded(() =>
        saveRecipe({
          id: recipe.id === "new" ? null : recipe.id,
          name: recipe.name,
          attachedProjectId: recipe.assignedProjectId ?? null,
          slots: recipe.slots.map((s) => ({
            paintId: s.paintId || null,
            hex: s.swatch,
            layer: s.layer,
          })),
          inspo: recipe.inspo.map((r) => r.url),
          notesMd: recipe.notes ?? null,
        }),
      );
      if (res.ok) {
        setSaved(true); // disarm the unsaved-changes guard for the redirect
        router.push(backTo ? `/projects/${backTo.projectId}` : "/recipes");
      } else {
        // Previously silent: a handled failure left SAVE looking like a no-op.
        toast(res.error, "red");
      }
    });
  }

  function remove() {
    if (recipe.id === "new") return;
    startTransition(async () => {
      const res = await guarded(
        () => deleteRecipe({ id: recipe.id }),
        "Couldn’t delete the recipe — check your connection, then try again.",
      );
      if (res.ok) {
        setSaved(true); // disarm the unsaved-changes guard for the redirect
        setConfirmingDelete(false);
        router.push("/recipes");
        router.refresh();
      } else {
        toast(res.error, "red");
      }
    });
  }

  /** AI creator "Approve" — identical to the /recipes workbench's handler
   *  (audit B8 asked for the two surfaces to behave the same): build a real
   *  recipe from the grounded proposal and persist it through the same action
   *  the editor saves with. The editor has no list to refresh into, so it
   *  navigates to the recipe that was just made. `setSaved` disarms the
   *  unsaved-changes guard for that redirect, exactly as `persist` does. */
  async function approveAiRecipe(proposal: GroundedRecipeProposal) {
    const res = await guarded(() =>
      saveRecipe({
        id: null,
        name: proposal.summary?.trim().slice(0, 60) || "AI recipe",
        attachedProjectId: null,
        slots: proposal.slots.map((s) => ({
          paintId: s.paintId || null,
          hex: s.hex,
          layer: s.layer,
        })),
        inspo: [],
        notesMd: proposal.techniqueNotes || null,
      }),
    );
    if (!res.ok) {
      toast(res.error, "red");
      return;
    }
    setAiOpen(false);
    setSaved(true);
    toast("AI recipe saved", "green");
    router.push(`/recipes/${res.data.id}`);
  }

  /** AI creator "+ Wishlist missing" → add each not-owned catalog paint to the
   *  collection wishlist, looked up in the already-loaded catalog for its name. */
  async function addMissingToWishlist(paintIds: string[]) {
    let failed = 0;
    for (const id of paintIds) {
      const p = paints.find((x) => x.id === id);
      if (!p) continue;
      const res = await guarded(() => createWishlistItem({ title: p.name, company: p.brand }));
      if (!res.ok) failed += 1;
    }
    // R2-9 — the loop used to discard every result, so a mid-loop rejection
    // both crashed the app and left the count unaccounted for.
    if (failed > 0) {
      toast(
        `Couldn’t add ${failed} paint${failed === 1 ? "" : "s"} — check your connection, then try again.`,
        "red",
      );
    }
    router.refresh();
  }

  function share() {
    if (recipe.id === "new") {
      toast("Save the recipe before sharing.", "red");
      return;
    }
    startTransition(async () => {
      const res = await guarded(
        () => publishRecipe({ recipeId: recipe.id }),
        "Couldn’t create the share link — check your connection, then try again.",
      );
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

  return (
    <>
      <RecipeEditorView
        recipe={recipe}
        projects={projects}
        resolvePaintMeta={resolvePaintMeta}
        onChange={setRecipe}
        onShare={share}
        onSave={persist}
        onAiGenerate={() => setAiOpen(true)}
        onDelete={isNew ? undefined : () => setConfirmingDelete(true)}
        backLabel={backTo ? `‹ back to ${backTo.title}` : "← Recipes"}
        onBack={() => {
          if (dirty) {
            setConfirmingLeave(true);
            return;
          }
          router.push(backTo ? `/projects/${backTo.projectId}` : "/recipes");
        }}
      />
      <ConfirmDialog
        open={confirmingLeave}
        breadcrumb="RECIPE"
        title="Discard changes?"
        message={UNSAVED_CHANGES_MESSAGE}
        confirmLabel="Discard"
        destructive
        onClose={() => setConfirmingLeave(false)}
        onConfirm={() => {
          setConfirmingLeave(false);
          router.push(backTo ? `/projects/${backTo.projectId}` : "/recipes");
        }}
      />
      <ConfirmDialog
        open={confirmingDelete}
        breadcrumb="RECIPE"
        title="Delete recipe?"
        message={`“${recipe.name || "Untitled recipe"}” and its ${recipe.slots.length} paint step${
          recipe.slots.length === 1 ? "" : "s"
        } will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        busy={isPending}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={remove}
      />
      <ShareLinkDialog url={shareUrl} open={shareUrl != null} onClose={() => setShareUrl(null)} />
      <AiRecipeDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApprove={approveAiRecipe}
        onAddMissing={addMissingToWishlist}
      />
      {node}
    </>
  );
}
