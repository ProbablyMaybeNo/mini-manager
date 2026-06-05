"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import { deleteRecipe, updateRecipe } from "@/lib/actions/recipes";
import { ShareButton } from "@/components/recipes/ShareButton";
import {
  RecipeActionsBar,
  type AssignProjectOption,
} from "@/components/recipes/RecipeActionsBar";
import type { MarkdownInput } from "@/lib/recipes/markdown";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";

interface AttachmentSummary {
  kind: "project" | "standalone";
  label: string;
  href?: string;
}

interface ShareData {
  /** Pre-built markdown input — the editor page derives this once from
   *  the nested recipe + paint meta so the modal doesn't have to round-
   *  trip for paint names. */
  markdown: MarkdownInput;
  /** Raw JSON-serialisable nested recipe (for the JSON export tab). */
  jsonPayload: unknown;
}

interface Props {
  recipe: Recipe;
  attachment: AttachmentSummary;
  share: ShareData;
  /** P12.4 — all of the user's projects, surfaced in the "Assign to
   *  project ▾" dropdown. The recipe page fetches these server-side
   *  + passes them down. */
  assignProjects: ReadonlyArray<AssignProjectOption>;
}

const NAME_DEBOUNCE_MS = 600;

/**
 * Top bar above the three panes. The name is edited inline via
 * `contentEditable` and saved with a debounce so a brisk typist
 * doesn't trigger a round-trip on every keystroke. Body-type pill is
 * read-only in v1 — only "infantry" is supported; vehicle/monster/
 * terrain are deferred to Phase 6.
 *
 * Delete uses a native `<dialog>` element (no modal library, per
 * the Phase 2 / Phase 3 convention). The dialog is owned here rather
 * than in the editor shell because the trigger lives in the header
 * row right next to it.
 */
export function RecipeHeader({
  recipe,
  attachment,
  share,
  assignProjects,
}: Props) {
  const router = useRouter();
  const nameRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(recipe.name);
  const [savedName, setSavedName] = useState(recipe.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state when the recipe id changes (e.g. router navigation).
  useEffect(() => {
    setName(recipe.name);
    setSavedName(recipe.name);
  }, [recipe.id, recipe.name]);

  // Debounced save when name changes.
  useEffect(() => {
    if (name === savedName) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await updateRecipe({ id: recipe.id, name: trimmed });
        if (result.ok) {
          setSavedName(result.data.name);
          setError(null);
        } else {
          setError(result.error);
        }
      });
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [name, savedName, recipe.id]);

  const openDelete = () => {
    dialogRef.current?.showModal();
  };
  const closeDelete = () => {
    dialogRef.current?.close();
  };
  const confirmDelete = () => {
    startTransition(async () => {
      const result = await deleteRecipe({ id: recipe.id });
      if (result.ok) {
        router.push("/recipes");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <header className="space-y-3 pb-4 border-b border-[var(--color-border)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1
            ref={nameRef}
            role="textbox"
            aria-label="Recipe name"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={(event) => setName(event.currentTarget.textContent ?? "")}
            onBlur={(event) => {
              const trimmed = event.currentTarget.textContent?.trim() ?? "";
              if (trimmed.length === 0) {
                event.currentTarget.textContent = savedName;
                setName(savedName);
              }
            }}
            className={clsx(
              "text-2xl font-mono outline-none min-w-0",
              "text-[var(--color-cyan)]",
              "focus:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)]",
              "px-2 -mx-2 rounded-sm",
            )}
            style={{
              textShadow:
                "0 0 8px color-mix(in srgb, var(--color-cyan) 35%, transparent)",
            }}
          >
            {recipe.name}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
            {/* Item 2 — the body-type ("INFANTRY") pill is removed: there's
                no "body" to assign in the flat recipe model anymore. The
                bodyType column stays in the DB (still carried in share /
                export payloads) but is no longer surfaced in the UI. */}
            {attachment.kind === "standalone" ? (
              <StatusPill status="neutral">Standalone</StatusPill>
            ) : attachment.href ? (
              <a
                href={attachment.href}
                className="inline-flex rounded-sm hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--color-cyan)_12%,transparent)] transition-colors"
                aria-label={`Open ${attachment.label} workspace`}
              >
                <StatusPill status="info" className="cursor-pointer">
                  Attached · {attachment.label} →
                </StatusPill>
              </a>
            ) : (
              <StatusPill status="info">
                Attached · {attachment.label}
              </StatusPill>
            )}
            {isPending ? <span>· saving…</span> : null}
          </div>
        </div>

        {/* D5 — action discipline: Save is the one prominent CTA (inside
            RecipeActionsBar); Assign + Share are secondary ghost actions.
            DELETE is demoted out of this cluster to a danger-outline at the
            bottom of the header (never a prominent slot). */}
        <div className="flex flex-col items-end gap-2">
          <RecipeActionsBar
            recipeId={recipe.id}
            isStandalone={recipe.isStandalone}
            projects={assignProjects}
            currentlyAttachedProjectId={recipe.attachedProjectId}
          />
          <ShareButton
            recipeId={recipe.id}
            recipeName={recipe.name}
            initialPublicSlug={recipe.publicSlug}
            markdownInput={share.markdown}
            jsonPayload={share.jsonPayload}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="frame px-3 py-2 text-sm font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}

      {/* D5 — demoted destructive action: danger-outline, bottom of the
          header, left-aligned away from the primary CTA cluster. */}
      <div className="pt-1">
        <Button
          type="button"
          onClick={openDelete}
          disabled={isPending}
          variant="danger"
          tone="outline"
          size="sm"
          title="Delete recipe"
        >
          Delete recipe
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] [&::backdrop]:bg-black/70 m-auto inset-0 max-h-[90vh] max-w-md"
      >
        <div className="p-5 space-y-4">
          <h2 className="text-base font-mono text-[var(--color-red)] uppercase tracking-wider">
            Delete recipe?
          </h2>
          <p className="text-sm font-sans text-[var(--color-fg-muted)]">
            This permanently removes <strong>{recipe.name}</strong> and every
            slot it contains. If it&apos;s attached to a project or unit the
            attachment will be cleared. This can&apos;t be undone.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={closeDelete}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={isPending}
              variant="danger"
              size="sm"
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </dialog>
    </header>
  );
}
