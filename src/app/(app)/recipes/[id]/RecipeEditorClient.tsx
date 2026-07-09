"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RecipeEditorView } from "@/components/recipe/RecipeEditorView";
import { ShareLinkDialog } from "@/components/recipe/ShareLinkDialog";
import { ConfirmDialog, useToast } from "@/components/kit";
import type { Paint, Project, Recipe } from "@/lib/types";
import { loadKitCatalog } from "@/lib/catalogClient";
import { saveRecipe } from "@/lib/actions/saveRecipe";
import { deleteRecipe } from "@/lib/actions/recipes";
import { publishRecipe } from "@/lib/actions/recipeSharing";
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
  // Gallery-listing opt-out (defaulted ON) — see ShareLinkDialog.
  const [listed, setListed] = useState(true);

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
      const res = await saveRecipe({
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
      });
      if (res.ok) {
        setSaved(true); // disarm the unsaved-changes guard for the redirect
        router.push(backTo ? `/projects/${backTo.projectId}` : "/recipes");
      }
    });
  }

  function remove() {
    if (recipe.id === "new") return;
    startTransition(async () => {
      const res = await deleteRecipe({ id: recipe.id });
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

  function share() {
    if (recipe.id === "new") {
      toast("Save the recipe before sharing.", "red");
      return;
    }
    startTransition(async () => {
      const res = await publishRecipe({ recipeId: recipe.id, listed });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      const url = `${window.location.origin}/r/${res.data.slug}`;
      // Convenience clipboard write + toast are kept, but the URL is also
      // revealed in a persistent, copyable field so it's never clipboard-only
      // (UX-004).
      void navigator.clipboard?.writeText(url);
      toast("Public link copied to clipboard", "green");
      setShareUrl(url);
    });
  }

  function updateListed(next: boolean) {
    setListed(next);
    if (!shareUrl || recipe.id === "new") return; // not published yet — the next share() call carries it
    startTransition(async () => {
      const res = await publishRecipe({ recipeId: recipe.id, listed: next });
      if (!res.ok) toast(res.error, "red");
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
      <ShareLinkDialog
        url={shareUrl}
        open={shareUrl != null}
        onClose={() => setShareUrl(null)}
        listed={listed}
        onListedChange={updateListed}
      />
      {node}
    </>
  );
}
