"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, ModalDialog } from "@/components/kit";
import { cn } from "@/lib/cn";
import { guarded } from "@/lib/actionGuard";
import {
  listRecipesForSendTo,
  sendPaletteToRecipe,
  type SendToRecipeOption,
} from "@/lib/actions/sendToRecipe";
import { useMockData } from "@/mock/MockProvider";
import { SignInToSaveDialog } from "@/components/tools/SignInToSaveDialog";
import { SubscribeGateDialog } from "@/components/billing/SubscribeGateDialog";
import { useSubscriber } from "@/lib/billing/SubscriberContext";
import type { ToolSwatch } from "@/lib/types";

/** @deprecated import `ToolSwatch` from `@/lib/types` — kept as an alias so
 *  existing call sites don't all need a rename. */
export type AssignSwatch = ToolSwatch;

/**
 * Which half of the "send colours to a recipe" flow to expose:
 *  - "both"   — the full chooser (existing recipes to append to, OR type a
 *               new name to create one). Used by every per-swatch "Assign"
 *               action (one colour, ambiguous whether it wants a new or
 *               existing home).
 *  - "create" — only the new-recipe-name input; skips fetching the recipe
 *               list entirely. Wheel/Dropper/Stacking's "Create Recipe" button.
 *  - "assign" — only the existing-recipe list. Wheel/Dropper/Stacking's
 *               "Assign to Recipe" button.
 */
export type AssignDialogMode = "both" | "create" | "assign";

export interface AssignedResult {
  recipeId: string;
  name: string;
  /** True when this landed on a brand-new recipe (vs. appended to one that
   *  already existed) — callers typically navigate to a freshly-created
   *  recipe (so the painter can start grounding colours to real paints) but
   *  just toast for an append. */
  created: boolean;
}

/**
 * Recipe picker for "assign / send to recipe" flows. Lists the painter's
 * recipes (append a run of slots) or mints a brand-new recipe from the
 * given swatches. Built on {@link ModalDialog}; lazy-loads the recipe list
 * the first time it opens.
 */
export function AssignToRecipeDialog({
  open,
  swatches,
  mode = "both",
  onClose,
  onAssigned,
  surface = "toolHandoff",
}: {
  open: boolean;
  swatches: AssignSwatch[];
  mode?: AssignDialogMode;
  onClose: () => void;
  onAssigned: (result: AssignedResult) => void;
  /** Which surface opened this dialog — forwarded to `sendPaletteToRecipe`,
   *  which gates on it (see that action's doc comment). Every colour-tool
   *  "Assign" flow is a "toolHandoff" (the default); the Library paint
   *  panel's plain "Add to Recipe" passes "library" to stay free. */
  surface?: "toolHandoff" | "library";
}) {
  const { signedIn } = useMockData();
  const isSubscriber = useSubscriber();
  // A "toolHandoff" open by a non-subscriber gets the gate dialog instead of
  // the recipe picker — client-side UX only, the server action re-checks.
  const gated = surface === "toolHandoff" && !isSubscriber;
  const [recipes, setRecipes] = useState<SendToRecipeOption[] | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // J2 — a signed-out visitor gets the "sign in to save" cue (below);
    // never fetch recipes, which would 307 to /sign-in via currentUserId()
    // and discard the palette.
    if (!signedIn) return;
    // Gated + non-subscriber gets the SubscribeGateDialog instead — skip the
    // fetch, same reasoning as the signed-out branch above.
    if (gated) return;
    setError(null);
    setNewName("");
    // "create" mode never shows the recipe list — skip the fetch entirely.
    if (mode === "create") {
      setRecipes([]);
      return;
    }
    setRecipes(null);
    let alive = true;
    listRecipesForSendTo().then((res) => {
      if (!alive) return;
      setRecipes(res.ok ? [...res.data] : []);
      if (!res.ok) setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [open, mode, signedIn, gated]);

  function send(target: { targetRecipeId: string } | { newRecipeName: string }, label: string) {
    if (pending || swatches.length === 0) return;
    setError(null);
    const created = "newRecipeName" in target;
    startTransition(async () => {
      // R2-14 — the colours only exist on the tool that built them, so a
      // rejection escaping into the route error boundary destroyed the very
      // palette this dialog was trying to save. Report it in the dialog's own
      // error slot; the swatches stay put and the button retries.
      const res = await guarded(
        () =>
          sendPaletteToRecipe({
            swatches: swatches.map((s) => ({
              hex: s.hex,
              paintId: s.paintId ?? undefined,
              name: s.name,
            })),
            surface,
            ...target,
          }),
        "Couldn’t send those colours — check your connection, then try again.",
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAssigned({ recipeId: res.data.recipeId, name: label, created });
      onClose();
    });
  }

  // J2 — signed-out: swap the recipe picker for the "sign in to save" cue.
  // Placed after all hooks so hook order is stable. Nothing navigates, so
  // the colours the painter built on the tool are preserved.
  if (!signedIn) {
    return <SignInToSaveDialog open={open} what="these colours" onClose={onClose} />;
  }

  if (gated) {
    return <SubscribeGateDialog open={open} onClose={onClose} />;
  }

  const count = swatches.length;
  const showList = mode !== "create";
  const showCreate = mode !== "assign";

  const title =
    mode === "create"
      ? "Create recipe from colours"
      : mode === "assign"
        ? "Assign to recipe"
        : count === 1
          ? "Assign to recipe"
          : "Send palette to recipe";

  const intro =
    mode === "create"
      ? `Start a new recipe with ${count} colour${count === 1 ? "" : "s"}.`
      : mode === "assign"
        ? `Add ${count} colour${count === 1 ? "" : "s"} to an existing recipe.`
        : count === 1
          ? "Add this paint to an existing recipe, or start a new one."
          : `Add ${count} colours to a recipe, or start a new one.`;

  return (
    <ModalDialog open={open} onClose={onClose} title={title} breadcrumb="RECIPES">
      <p className="mb-3 font-body text-body text-fg">{intro}</p>

      {showList && (
        <div className="mb-4 flex flex-col gap-2">
          {recipes === null ? (
            <p className="font-body text-body text-fg">▸ Loading recipes…</p>
          ) : recipes.length === 0 ? (
            <p className="font-body text-body text-fg">
              {mode === "assign"
                ? "No recipes yet — use Create Recipe instead."
                : "No recipes yet — create one below."}
            </p>
          ) : (
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {recipes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={pending}
                  onClick={() => send({ targetRecipeId: r.id }, r.name)}
                  className="border border-cyan/30 px-3 py-2 text-left font-body text-body text-fg hover:border-cyan hover:bg-cyan/10 disabled:opacity-50"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className={cn("flex gap-2 pt-3", showList && "border-t border-cyan/20")}>
          <Input
            name="new-recipe-name"
            placeholder="New recipe name"
            value={newName}
            disabled={pending}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              newName.trim() &&
              send({ newRecipeName: newName.trim() }, newName.trim())
            }
            containerClassName="flex-1"
          />
          <Button
            size="sm"
            disabled={pending || !newName.trim()}
            onClick={() => send({ newRecipeName: newName.trim() }, newName.trim())}
          >
            Create
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-3 font-body text-body text-red-text" role="alert">
          ▸ {error}
        </p>
      )}
    </ModalDialog>
  );
}
