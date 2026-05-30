"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Recipe } from "@/db/schema";
import {
  attachRecipeToNamedModel,
  attachRecipeToProject,
  createRecipe,
} from "@/lib/actions/recipes";

export interface RecipeOption {
  id: string;
  name: string;
  /** Where the recipe is currently attached (used as a heads-up so the
   *  painter knows picking it MOVES the attachment). */
  attachmentLabel: string | null;
}

interface BaseProps {
  open: boolean;
  onClose: () => void;
  /** Standalone + already-attached-elsewhere recipes for this user. */
  candidates: ReadonlyArray<RecipeOption>;
}

interface ProjectProps extends BaseProps {
  mode: "project";
  projectId: string;
}

interface NamedModelProps extends BaseProps {
  mode: "named-model";
  namedModelId: string;
}

type Props = ProjectProps | NamedModelProps;

type Tab = "pick" | "create";

/**
 * Two-tab modal — Pick existing OR Create new. Uses a native <dialog>
 * so we don't pull a modal library. Search in the Pick tab is a simple
 * substring match on `name`. After a successful attach, the modal
 * closes and the parent revalidates (server action does this).
 */
export function AttachRecipeModal(props: Props) {
  const { open, onClose, candidates } = props;
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("pick");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [confirmMove, setConfirmMove] = useState<RecipeOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync open/close with the native dialog element.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reset state on close.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setName("");
      setConfirmMove(null);
      setError(null);
      setTab("pick");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [candidates, query]);

  const pickRecipe = (recipe: RecipeOption) => {
    if (recipe.attachmentLabel) {
      setConfirmMove(recipe);
      return;
    }
    runAttach(recipe.id);
  };

  const runAttach = (recipeId: string) => {
    setError(null);
    setConfirmMove(null);
    startTransition(async () => {
      const result =
        props.mode === "project"
          ? await attachRecipeToProject({
              recipeId,
              projectId: props.projectId,
            })
          : await attachRecipeToNamedModel({
              recipeId,
              namedModelId: props.namedModelId,
            });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      const result = await createRecipe({
        name: trimmed,
        bodyType: "infantry",
        attachedProjectId:
          props.mode === "project" ? props.projectId : null,
        attachedNamedModelId:
          props.mode === "named-model" ? props.namedModelId : null,
      });
      if (result.ok) {
        onClose();
        router.push(`/recipes/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Attach recipe"
      className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] backdrop:bg-black/70 w-[480px] max-w-[92vw]"
    >
      <div className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-mono uppercase tracking-wider text-[var(--color-cyan)]">
          Attach recipe
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 pt-3">
        <TabButton
          active={tab === "pick"}
          onClick={() => setTab("pick")}
          label="Pick existing"
        />
        <TabButton
          active={tab === "create"}
          onClick={() => setTab("create")}
          label="Create new"
        />
      </div>

      <div className="p-4 space-y-3 min-h-[200px]">
        {tab === "pick" ? (
          <>
            <input
              type="search"
              placeholder="Search recipes…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              className="block w-full px-3 py-2 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-cyan)]"
            />
            {filtered.length === 0 ? (
              <p className="text-xs font-sans text-[var(--color-fg-muted)] px-1">
                No recipes match. Try Create new.
              </p>
            ) : (
              <div className="max-h-[260px] overflow-y-auto frame divide-y divide-[var(--color-border)]">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickRecipe(c)}
                    disabled={isPending}
                    className={clsx(
                      "w-full px-3 py-2 text-left tap-target",
                      "hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]",
                      isPending && "opacity-60 cursor-progress",
                    )}
                  >
                    <span className="block font-mono text-sm text-[var(--color-fg)]">
                      {c.name}
                    </span>
                    {c.attachmentLabel ? (
                      <span className="block text-2xs font-mono text-[var(--color-amber)] uppercase tracking-wider">
                        moves from: {c.attachmentLabel}
                      </span>
                    ) : (
                      <span className="block text-2xs font-mono text-[var(--color-fg-muted)] uppercase tracking-wider">
                        standalone
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <label
              htmlFor="attach-recipe-name"
              className="block section-title mb-0 pb-0 border-0"
            >
              Recipe name
            </label>
            <input
              id="attach-recipe-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Salamanders Tactical"
              maxLength={120}
              autoFocus
              className="block w-full px-3 py-2 font-mono text-sm bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
            />
            <p className="text-2xs font-sans text-[var(--color-fg-muted)]">
              Creates an empty recipe attached here and opens the editor.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className={clsx(
                  "inline-flex items-center gap-2 px-3 py-2 frame-strong tap-target text-xs font-mono",
                  isPending
                    ? "opacity-60 cursor-progress"
                    : "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:text-[var(--color-accent)]",
                )}
              >
                {isPending ? "[ … ] Creating" : "[ + ] Create & attach"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-3"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error ? (
          <p
            role="alert"
            className="frame px-3 py-2 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      {confirmMove ? (
        <div className="border-t border-[var(--color-border)] p-4 space-y-3 bg-[color-mix(in_srgb,var(--color-amber)_6%,transparent)]">
          <p className="text-xs font-sans text-[var(--color-fg-muted)]">
            <strong className="text-[var(--color-amber)]">
              {confirmMove.name}
            </strong>{" "}
            is currently attached to{" "}
            <strong>{confirmMove.attachmentLabel}</strong>. Attaching it here
            will clear that link. Continue?
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => runAttach(confirmMove.id)}
              disabled={isPending}
              className={clsx(
                "inline-flex items-center gap-2 px-3 py-2 frame-strong tap-target text-xs font-mono",
                isPending
                  ? "opacity-60 cursor-progress"
                  : "hover:bg-[color-mix(in_srgb,var(--color-amber)_10%,transparent)] hover:text-[var(--color-amber)]",
              )}
            >
              {isPending ? "[ … ] Moving" : "[ ↪ ] Move attachment"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmMove(null)}
              className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 text-2xs font-mono uppercase tracking-wider tap-target rounded-sm",
        active
          ? "text-[var(--color-cyan)] bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)]"
          : "text-[var(--color-fg-muted)]",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
