"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

import { projectTypes, type ProjectType } from "@/db/schema";
import {
  markBoughtAsNewProject,
  markBoughtAsExistingUnit,
} from "@/lib/actions/markBought";
import { inferKitContents } from "@/lib/wishlist/kitInference";

export interface MarkBoughtProjectOption {
  id: string;
  name: string;
  type: ProjectType;
  count: number;
  ownedCount: number;
  parentId: string | null;
}

type Tab = "existing" | "new";

/**
 * Modal popped from the WishlistTable or detail drawer when a painter
 * marks a row Bought. Two tabs: bump an existing Unit's owned_count,
 * or create a new Project pre-filled from the kit's title.
 */
export function MarkBoughtModal({
  open,
  onClose,
  itemId,
  title,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  itemId: string;
  title: string;
  projects: ReadonlyArray<MarkBoughtProjectOption>;
}) {
  const router = useRouter();
  const inference = useMemo(() => inferKitContents(title), [title]);
  const [tab, setTab] = useState<Tab>("existing");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // New project tab state
  const [newName, setNewName] = useState(title);
  const [newType, setNewType] = useState<ProjectType>(inference.suggestedType);
  const [newCount, setNewCount] = useState<number>(inference.modelCount);
  const [newParentId, setNewParentId] = useState<string | "">("");

  // Existing-unit tab state
  const eligible = useMemo(
    () =>
      projects.filter(
        (p) => p.type === "Unit" || p.type === "Single Model" || p.type === "Terrain Piece",
      ),
    [projects],
  );
  const [targetId, setTargetId] = useState<string | "">(eligible[0]?.id ?? "");
  const [delta, setDelta] = useState<number>(Math.max(1, inference.modelCount));

  // Reset internal state every time the modal re-opens for a new item.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setTab(eligible.length > 0 ? "existing" : "new");
    setNewName(title);
    setNewType(inference.suggestedType);
    setNewCount(inference.modelCount);
    setNewParentId("");
    setTargetId(eligible[0]?.id ?? "");
    setDelta(Math.max(1, inference.modelCount));
  }, [open, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const armies = projects.filter((p) => p.type === "Army" || p.type === "Warband");

  function submitNew() {
    setError(null);
    startTransition(async () => {
      const result = await markBoughtAsNewProject({
        wishlistItemId: itemId,
        name: newName.trim(),
        type: newType,
        count: newCount,
        parentId: newParentId === "" ? null : newParentId,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      onClose();
      router.push(`/projects/${result.data.projectId}`);
    });
  }

  function submitExisting() {
    if (!targetId) {
      setError("Pick a project first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await markBoughtAsExistingUnit({
        wishlistItemId: itemId,
        projectId: targetId,
        delta,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const target = projects.find((p) => p.id === targetId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark bought"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[var(--color-bg-panel)] frame-strong shadow-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between gap-2 p-4 border-b border-[var(--color-border)]">
          <h2 className="font-mono text-base text-[var(--color-fg)]">
            Mark bought · {title.length > 36 ? `${title.slice(0, 34)}…` : title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-mono px-2 py-1 hover:text-[var(--color-amber)] tap-target"
            aria-label="Cancel"
          >
            [ × ]
          </button>
        </header>

        <div className="flex border-b border-[var(--color-border)]">
          <TabButton active={tab === "existing"} onClick={() => setTab("existing")}>
            Existing unit
          </TabButton>
          <TabButton active={tab === "new"} onClick={() => setTab("new")}>
            New project
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === "existing" ? (
            <>
              {eligible.length === 0 ? (
                <p className="text-sm font-mono text-[var(--color-fg-muted)]">
                  No existing Unit / Single Model / Terrain Piece projects yet.
                  Switch to the New project tab.
                </p>
              ) : (
                <>
                  <Field label="Project">
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className={inputClass}
                    >
                      {eligible.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))}
                    </select>
                  </Field>
                  {target ? (
                    <p className="text-2xs font-mono text-[var(--color-fg-muted)]">
                      Current roster: {target.ownedCount} / {target.count} owned.
                    </p>
                  ) : null}
                  <Field label="Add this many bottles / models">
                    <input
                      type="number"
                      min={1}
                      value={delta}
                      onChange={(e) => setDelta(Math.max(1, Number(e.target.value)))}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
            </>
          ) : (
            <>
              <Field label="Name">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Type">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ProjectType)}
                  className={inputClass}
                >
                  {projectTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Count (models in the kit)">
                <input
                  type="number"
                  min={newType === "Single Model" ? 1 : 0}
                  value={newCount}
                  onChange={(e) => setNewCount(Math.max(0, Number(e.target.value)))}
                  className={inputClass}
                />
              </Field>
              <Field label="Parent (optional)">
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">(none)</option>
                  {armies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-2xs font-mono text-[var(--color-fg-subtle)]">
                Inferred kit size: {inference.modelCount} model
                {inference.modelCount === 1 ? "" : "s"} ·{" "}
                {inference.suggestedType}. Adjust as needed.
              </p>
            </>
          )}

          {error ? (
            <p role="alert" className="text-xs font-mono text-[var(--color-red)]">
              [ ! ] {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono px-3 py-2 frame tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={tab === "existing" ? submitExisting : submitNew}
            disabled={isPending}
            className="text-xs font-mono px-3 py-2 frame-strong tap-target hover:bg-[color-mix(in_srgb,var(--color-green)_10%,transparent)] hover:text-[var(--color-green)]"
          >
            {isPending ? "Working…" : "[ ✓ Mark bought ]"}
          </button>
        </footer>
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
      onClick={onClick}
      className={clsx(
        "flex-1 px-4 py-2 text-xs font-mono uppercase tracking-wider",
        active
          ? "text-[var(--color-green)] border-b-2 border-[var(--color-green)] -mb-px bg-[color-mix(in_srgb,var(--color-green)_8%,transparent)]"
          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
      )}
    >
      {children}
    </button>
  );
}

const inputClass =
  "w-full px-2 py-1.5 frame bg-[var(--color-bg-elevated)] font-mono text-sm focus:border-[var(--color-green)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
      <span>{label}</span>
      {children}
    </label>
  );
}
