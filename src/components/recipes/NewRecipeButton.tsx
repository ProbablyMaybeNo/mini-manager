"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecipe } from "@/lib/actions/recipes";
import { Button } from "@/components/ui/Button";

interface Props {
  defaultName?: string;
  attachedProjectId?: string;
  variant?: "primary" | "subtle";
  label?: string;
  /** FIGMA-REBUILD — `row` renders the mock's full-width trailing
   *  `+ RECIPE` outline create row inside the table panel. */
  trigger?: "button" | "row";
}

/**
 * Single button that opens a small "Name your recipe" dialog and, on
 * submit, creates the recipe via the server action and navigates to
 * its editor. Used on /recipes and inside the AttachRecipeModal
 * "Create new" tab (P3.6).
 *
 * R7-007 — the previous one-click flow silently filed every new row as
 * "Untitled recipe", and recruits accumulated six of them after three
 * sessions. The required-name prompt forces a deliberate label before
 * the row hits the table.
 */
export function NewRecipeButton({
  defaultName = "",
  attachedProjectId,
  variant = "primary",
  label = "New recipe",
  trigger = "button",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  // P10.2 — soft inline upgrade affordance when a free-tier cap fires.
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Auto-focus the name input on open so the painter can start
      // typing immediately (Esc + click-outside still close the modal).
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Give your recipe a name to keep the library scannable.");
      return;
    }
    setError(null);
    setUpgradeUrl(null);
    startTransition(async () => {
      const result = await createRecipe({
        name: trimmed,
        bodyType: "infantry",
        attachedProjectId: attachedProjectId ?? null,
      });
      if (result.ok) {
        setOpen(false);
        setName("");
        router.push(`/recipes/${result.data.id}`);
      } else {
        setError(result.error);
        setUpgradeUrl(result.upgradeUrl ?? null);
      }
    });
  };

  const close = () => {
    if (isPending) return;
    setOpen(false);
    setError(null);
  };

  return (
    <>
      {/* UX-002 — on /recipes this is the page's single dominant CTA, so the
          "primary" call site takes the cyan PRIMARY tier (was green/success,
          which let the louder per-row Share/Assign actions compete with the
          page lead). The "subtle" call site (inside modals) stays ghost. */}
      {trigger === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-cyan)] border-t border-[var(--color-cyan-dim)] bg-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--color-cyan)_8%,transparent)] tap-target motion-reduce:transition-none"
        >
          + Recipe
        </button>
      ) : (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          variant={variant === "primary" ? "primary" : "ghost"}
          size="sm"
        >
          {label}
        </Button>
      )}
      <dialog
        ref={dialogRef}
        onClose={close}
        aria-label="Name your recipe"
        className="frame-strong p-0 bg-[var(--color-bg-panel)] text-[var(--color-fg)] backdrop:bg-black/70 m-auto inset-0 w-[420px] max-w-[92vw]"
      >
        <div
          className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between"
        >
          <p className="text-sm font-mono uppercase tracking-wider text-[var(--color-cyan)]">
            New recipe
          </p>
          <button
            type="button"
            onClick={close}
            className="text-xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <label className="block space-y-2">
            <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
              Recipe name
            </span>
            <input
              ref={inputRef}
              type="text"
              required
              maxLength={120}
              autoComplete="off"
              placeholder="Skin · gold trim · battle dust"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 frame-strong tap-target font-mono text-sm bg-transparent text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          {error ? (
            <p
              role="alert"
              className="frame px-3 py-2 text-2xs font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)] flex items-center justify-between gap-3 flex-wrap"
            >
              <span>{error}</span>
              {upgradeUrl ? (
                <a
                  href={upgradeUrl}
                  className="font-mono text-2xs uppercase tracking-wider text-[var(--color-green)] underline-offset-2 hover:underline whitespace-nowrap"
                >
                  Upgrade →
                </a>
              ) : null}
            </p>
          ) : null}
          <p className="text-2xs font-sans text-[var(--color-fg-subtle)] leading-snug">
            Naming up front keeps the recipe library scannable — six
            "Untitled recipe" rows piles up fast.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={close}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              size="sm"
              disabled={isPending || name.trim().length === 0}
            >
              {isPending ? "Creating…" : "Create recipe"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
