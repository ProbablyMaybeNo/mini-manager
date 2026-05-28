"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  listRecipesForSendTo,
  sendPaletteToRecipe,
  type SendToRecipeOption,
} from "@/lib/actions/sendToRecipe";
import type { ToolPaletteSwatch, ToolId } from "@/lib/tools/types";

interface Props {
  open: boolean;
  onClose: () => void;
  swatches: ReadonlyArray<ToolPaletteSwatch>;
  /** The tool the modal was opened from — used to label the default
   *  zone name when creating a brand-new recipe. */
  toolId: ToolId;
}

type Tab = "existing" | "new";

const TOOL_LABEL: Record<ToolId, string> = {
  wheel: "Wheel",
  match: "Match",
  eyedropper: "Eyedropper",
  gradient: "Gradient",
};

/**
 * Two-tab modal that hands a palette to either an existing recipe or a
 * brand-new standalone one. Reuses the existing recipe / zone / step
 * actions transparently via `sendPaletteToRecipe`.
 */
export function SendToRecipeModal({ open, onClose, swatches, toolId }: Props) {
  const headingId = useId();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("existing");
  const [recipes, setRecipes] = useState<ReadonlyArray<SendToRecipeOption>>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>("__new__");
  const [newZoneName, setNewZoneName] = useState(TOOL_LABEL[toolId]);
  const [newRecipeName, setNewRecipeName] = useState(
    `${TOOL_LABEL[toolId]} palette`,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ recipeId: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadingList(true);
    setError(null);
    setSuccess(null);
    listRecipesForSendTo()
      .then((res) => {
        if (!mounted) return;
        if (res.ok) {
          setRecipes(res.data);
          if (res.data.length > 0) {
            const first = res.data[0];
            if (first) {
              setSelectedRecipeId(first.id);
              setSelectedZoneId(first.zones[0]?.id ?? "__new__");
            }
          } else {
            // No recipes yet → flip to the "new" tab so the painter sees
            // an actionable form instead of an empty combobox.
            setTab("new");
          }
        } else {
          setError(res.error);
        }
      })
      .finally(() => {
        if (mounted) setLoadingList(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId),
    [recipes, selectedRecipeId],
  );

  if (!open) return null;

  const swatchCount = swatches.length;
  const canSubmit = !isPending && swatchCount > 0 && !success;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    startTransition(async () => {
      const baseSwatches = swatches.map((s) => ({
        hex: s.hex,
        paintId: s.sourcePaintId ?? null,
        name: s.name,
      }));
      const result =
        tab === "new"
          ? await sendPaletteToRecipe({
              swatches: baseSwatches,
              newRecipeName: newRecipeName.trim(),
              zoneName: newZoneName.trim() || TOOL_LABEL[toolId],
            })
          : await sendPaletteToRecipe({
              swatches: baseSwatches,
              targetRecipeId: selectedRecipeId,
              targetZoneId:
                selectedZoneId === "__new__" ? undefined : selectedZoneId,
              zoneName: newZoneName.trim() || TOOL_LABEL[toolId],
            });
      if (result.ok) {
        setSuccess({ recipeId: result.data.recipeId });
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="frame-strong bg-[var(--color-bg-panel)] w-full max-w-md shadow-xl">
        <header className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
          <h2 id={headingId} className="font-mono text-sm glow-green">
            ┌─ SEND TO RECIPE ─
          </h2>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-2"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="px-4 py-3 space-y-3">
          <div className="frame px-2 py-1.5 flex items-center gap-2 flex-wrap">
            {swatches.slice(0, 12).map((s, i) => (
              <span
                key={`${s.hex}-${i}`}
                aria-hidden
                className="inline-block w-5 h-5 rounded-sm border"
                style={{
                  background: s.hex,
                  borderColor: "var(--color-border-strong)",
                }}
              />
            ))}
            <span className="text-2xs font-mono text-[var(--color-fg-muted)] ml-auto">
              {swatchCount} swatch{swatchCount === 1 ? "" : "es"}
            </span>
          </div>

          <div role="tablist" className="flex gap-1">
            <TabButton
              active={tab === "existing"}
              onClick={() => setTab("existing")}
            >
              Existing recipe
            </TabButton>
            <TabButton active={tab === "new"} onClick={() => setTab("new")}>
              New recipe
            </TabButton>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "existing" ? (
              loadingList ? (
                <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                  Loading recipes…
                </p>
              ) : recipes.length === 0 ? (
                <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                  No recipes yet — use the New recipe tab.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block section-title mb-0 pb-0 border-0">
                      Recipe
                    </label>
                    <select
                      value={selectedRecipeId}
                      onChange={(e) => {
                        setSelectedRecipeId(e.target.value);
                        const r = recipes.find((x) => x.id === e.target.value);
                        setSelectedZoneId(r?.zones[0]?.id ?? "__new__");
                      }}
                      className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
                    >
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block section-title mb-0 pb-0 border-0">
                      Zone
                    </label>
                    <select
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                      className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
                    >
                      <option value="__new__">+ Add new zone…</option>
                      {selectedRecipe?.zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedZoneId === "__new__" ? (
                    <div className="space-y-1">
                      <label className="block section-title mb-0 pb-0 border-0">
                        New zone name
                      </label>
                      <input
                        type="text"
                        value={newZoneName}
                        onChange={(e) => setNewZoneName(e.target.value)}
                        maxLength={80}
                        className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
                      />
                    </div>
                  ) : null}
                </>
              )
            ) : (
              <>
                <div className="space-y-1">
                  <label className="block section-title mb-0 pb-0 border-0">
                    New recipe name
                  </label>
                  <input
                    type="text"
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    maxLength={120}
                    className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block section-title mb-0 pb-0 border-0">
                    Zone name
                  </label>
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    maxLength={80}
                    className="block w-full px-2 py-1.5 font-mono text-xs bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-green)]"
                  />
                </div>
              </>
            )}

            {error ? (
              <p
                role="alert"
                className="text-2xs font-mono text-[var(--color-red)]"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <div className="space-y-2">
                <p
                  role="status"
                  className="text-2xs font-mono text-[var(--color-green)]"
                >
                  ✓ Palette sent. {swatchCount} step
                  {swatchCount === 1 ? "" : "s"} added.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/recipes/${success.recipeId}`);
                    onClose();
                  }}
                  className="px-3 py-1.5 frame-strong text-xs font-mono uppercase tracking-wider hover:bg-[color-mix(in_srgb,var(--color-cyan)_10%,transparent)] hover:text-[var(--color-cyan)]"
                >
                  [ Open recipe → ]
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={clsx(
                    "px-3 py-1.5 frame-strong text-xs font-mono uppercase tracking-wider tap-target",
                    canSubmit
                      ? "hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)] hover:text-[var(--color-green)]"
                      : "opacity-60 cursor-not-allowed",
                  )}
                >
                  {isPending ? "Sending…" : "[ Send → ]"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-2xs font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-cyan)] tap-target px-3"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "px-2 py-1 text-2xs font-mono uppercase tracking-wider tap-target rounded-sm",
        active
          ? "text-[var(--color-green)] bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)]"
          : "text-[var(--color-fg-muted)]",
      )}
    >
      {children}
    </button>
  );
}
