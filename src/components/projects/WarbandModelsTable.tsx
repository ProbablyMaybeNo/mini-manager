"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { Priority } from "@/db/schema";
import { priorities } from "@/db/schema";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import {
  InlineCellPopover,
  InlineCellPopoverItem,
} from "@/components/ui/InlineCellPopover";
import { Button } from "@/components/ui/Button";
import type { DisplayStatus } from "@/lib/progress";
import {
  bumpProjectStatus,
  setModelClass,
  updateProjectPriority,
} from "@/lib/actions/projects";
import {
  AttachRecipeModal,
  type RecipeOption,
} from "@/components/recipes/AttachRecipeModal";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";

/**
 * batch/model-warband — the per-model table that replaces the recipe
 * box at the top of a Warband's project page.
 *
 * A Warband's models ARE the existing Unit sub-projects (created via the
 * parent flow — createProject parent=warband, type=Unit; the 3-level cap
 * + Unit-only-children rule are unchanged). This table mirrors the
 * ProjectsDashboardTable row format but is a FLAT list (no hierarchy /
 * expansion) with a Warband-specific "Class" column writing the new
 * `modelClass` column.
 *
 * Columns: Name (link) · Class (inline editor) · Recipe (+ATTACH /
 * swatches) · Status (StatusPill, bumpProjectStatus) · Priority
 * (InlineCellPopover) · Completion (ProgressBar) · Delete.
 *
 * Every interactive primitive is REUSED, not rebuilt: StatusPill,
 * InlineCellPopover, ProgressBar, AttachRecipeModal, DeleteProjectButton.
 */

const STATUS_ORDER: ReadonlyArray<DisplayStatus> = [
  "WISHLIST",
  "PURCHASED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
  "SHELVED",
];

const STATUS_PILL: Record<DisplayStatus, StatusPillKind> = {
  WISHLIST: "wishlist",
  PURCHASED: "neutral",
  BUILDING: "info",
  PRIMING: "info",
  PAINTING: "warning",
  BASING: "warning",
  COMPLETE: "ok",
  SHELVED: "neutral",
};

/** Per-model row VM. The Warband page builds these server-side from the
 *  child Unit projects + getProjectPalettesMap + getProjectFirstRecipeMap
 *  + the displayStatus / progressPercent helpers. */
export interface WarbandModelRow {
  id: string;
  name: string;
  modelClass: string | null;
  priority: Priority | null;
  status: DisplayStatus;
  paletteHexes: string[];
  progressPercent: number;
  /** First attached recipe id (createdAt asc); null = none attached. */
  firstAttachedRecipeId: string | null;
}

interface Props {
  /** The parent Warband project id — drives the "+ Model" deep-link. */
  warbandId: string;
  rows: ReadonlyArray<WarbandModelRow>;
  /** Every recipe the user owns — the per-row Recipe cell filters to the
   *  candidates that aren't yet attached to THAT model. */
  ownedRecipes: ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>;
  /** projectId -> human name lookup so the AttachRecipeModal can show
   *  "currently attached to <X>" move-warnings. */
  projectNameById: Readonly<Record<string, string>>;
}

export function WarbandModelsTable({
  warbandId,
  rows,
  ownedRecipes,
  projectNameById,
}: Props) {
  // The model-creation flow is the existing parent flow: a Unit
  // sub-project under this Warband. Deep-link matches AddChildMenu.
  const newModelHref = `/projects/new?parent=${warbandId}&type=Unit`;

  return (
    <section className="space-y-3" aria-label="Warband models">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title mb-0 pb-0 border-0">
          Models · {rows.length}
        </h2>
        {/* ADD/CREATE → success-green per the P12.23 button discipline;
            no cyan on the add action. */}
        <Button as="a" href={newModelHref} variant="success" size="sm">
          + Model
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="frame px-3 py-4 text-xs font-sans text-[var(--color-fg-muted)] leading-relaxed">
          No models yet. Use{" "}
          <span className="font-mono text-[var(--color-green)]">+ Model</span>{" "}
          to add the first model to this warband. Each model is its own
          sub-project — attach a recipe, set its class, and track it to
          completion.
        </p>
      ) : (
        <div className="frame overflow-x-auto">
          <table className="mm-density-rows w-full text-xs font-mono">
            <thead>
              <tr
                className="text-left text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]"
                style={{ borderBottom: "1px solid var(--color-border-strong)" }}
              >
                <th scope="col" className="px-3 py-2">Name</th>
                <th scope="col" className="px-3 py-2">Class</th>
                <th scope="col" className="px-3 py-2">Recipe</th>
                <th scope="col" className="px-3 py-2">Status</th>
                <th scope="col" className="px-3 py-2">Priority</th>
                <th scope="col" className="px-3 py-2">Completion</th>
                <th
                  scope="col"
                  className="px-3 py-2 text-right"
                  aria-label="Row actions"
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ModelRow
                  key={row.id}
                  row={row}
                  ownedRecipes={ownedRecipes}
                  projectNameById={projectNameById}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ModelRow({
  row,
  ownedRecipes,
  projectNameById,
}: {
  row: WarbandModelRow;
  ownedRecipes: ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>;
  projectNameById: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachOpen, setAttachOpen] = useState(false);

  const attachCandidates: ReadonlyArray<RecipeOption> = useMemo(() => {
    return ownedRecipes
      .filter((r) => r.attachedProjectId !== row.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        attachmentLabel: r.attachedProjectId
          ? projectNameById[r.attachedProjectId] ?? "(project)"
          : null,
      }));
  }, [ownedRecipes, projectNameById, row.id]);

  const handleStatus = (next: DisplayStatus) => {
    startTransition(async () => {
      const result = await bumpProjectStatus({ id: row.id, status: next });
      if (result.ok) router.refresh();
    });
  };

  const handlePriority = (next: Priority | null) => {
    startTransition(async () => {
      const result = await updateProjectPriority({ id: row.id, priority: next });
      if (result.ok) router.refresh();
    });
  };

  const handleRecipeCellClick = () => {
    if (row.firstAttachedRecipeId) {
      router.push(`/recipes/${row.firstAttachedRecipeId}`);
    } else {
      setAttachOpen(true);
    }
  };

  return (
    <tr
      className={clsx(
        "transition-colors",
        "hover:bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)]",
        pending && "opacity-70",
      )}
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      {/* Name — link to the model's own project page. */}
      <td className="px-3 py-2">
        <Link
          href={`/projects/${row.id}`}
          className="group inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          title={`Open ${row.name}`}
        >
          {row.name}
          <span
            aria-hidden
            className="text-2xs text-[var(--color-fg-subtle)] group-hover:text-[var(--color-accent)] transition-colors"
          >
            ↗
          </span>
        </Link>
      </td>

      {/* Class — inline free-text editor writing modelClass. */}
      <td className="px-3 py-2">
        <ModelClassCell modelId={row.id} value={row.modelClass} />
      </td>

      {/* Recipe — + ATTACH via AttachRecipeModal, or swatch strip. */}
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={handleRecipeCellClick}
          className="tap-target inline-flex items-center text-left cursor-pointer hover:opacity-80 transition-opacity"
          aria-label={
            row.firstAttachedRecipeId ? "Open attached recipe" : "Attach a recipe"
          }
        >
          {row.paletteHexes.length > 0 ? (
            <PaletteStrip hexes={row.paletteHexes} />
          ) : (
            <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] transition-colors">
              + attach
            </span>
          )}
        </button>
        <AttachRecipeModal
          mode="project"
          projectId={row.id}
          open={attachOpen}
          onClose={() => setAttachOpen(false)}
          candidates={attachCandidates}
        />
      </td>

      {/* Status — StatusPill, settable via bumpProjectStatus. */}
      <td className="px-3 py-2">
        <InlineCellPopover
          triggerLabel={`Status · ${row.status}`}
          trigger={
            <StatusPill status={STATUS_PILL[row.status]}>
              {row.status}
            </StatusPill>
          }
        >
          {STATUS_ORDER.map((s) => (
            <InlineCellPopoverItem
              key={s}
              active={s === row.status}
              onClick={() => handleStatus(s)}
            >
              {s}
            </InlineCellPopoverItem>
          ))}
        </InlineCellPopover>
      </td>

      {/* Priority — the existing priority InlineCellPopover. */}
      <td className="px-3 py-2">
        <InlineCellPopover
          triggerLabel={`Priority · ${row.priority ?? "Unset"}`}
          trigger={
            <span className="font-mono text-xs text-[var(--color-fg-muted)]">
              {row.priority ?? "—"}
            </span>
          }
        >
          {priorities.map((p) => (
            <InlineCellPopoverItem
              key={p}
              active={p === row.priority}
              onClick={() => handlePriority(p)}
            >
              {p}
            </InlineCellPopoverItem>
          ))}
          <InlineCellPopoverItem destructive onClick={() => handlePriority(null)}>
            Clear
          </InlineCellPopoverItem>
        </InlineCellPopover>
      </td>

      {/* Completion — ProgressBar from progressPercent. */}
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2">
          <ProgressBar percent={row.progressPercent} width={22} />
          <span className="text-2xs font-mono text-[var(--color-fg-muted)] tabular-nums">
            {row.progressPercent}%
          </span>
        </span>
      </td>

      {/* Delete — DeleteProjectButton (inline, red). */}
      <td className="px-3 py-2 text-right">
        <DeleteProjectButton
          projectId={row.id}
          projectName={row.name}
          redirectToProjectsOnSuccess={false}
          inline
          label="Delete"
        />
      </td>
    </tr>
  );
}

const CLASS_DEBOUNCE_MS = 600;

/**
 * Inline free-text editor for a model's Class cell. Debounced save
 * (600ms) mirrors EditableProjectTitle so a brisk typist doesn't fire a
 * round-trip per keystroke. Empty input clears the column back to null
 * (the action collapses blank -> null). Optimistic local state resets
 * when the server-provided value changes (after a revalidate).
 */
function ModelClassCell({
  modelId,
  value,
}: {
  modelId: string;
  value: string | null;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [saved, setSaved] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync when the server pushes a new value (revalidatePath).
  useEffect(() => {
    setDraft(value ?? "");
    setSaved(value ?? "");
  }, [modelId, value]);

  useEffect(() => {
    if (draft === saved) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const result = await setModelClass({
          id: modelId,
          modelClass: draft,
        });
        if (result.ok) {
          setSaved(result.data.modelClass ?? "");
          setError(null);
        } else {
          setError(result.error);
        }
      });
    }, CLASS_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [draft, saved, modelId]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={40}
        placeholder="—"
        aria-label="Model class"
        onChange={(e) => setDraft(e.target.value)}
        className={clsx(
          "tap-target w-28 min-w-0 px-2 py-1 font-mono text-xs",
          "bg-transparent frame text-[var(--color-fg)]",
          "placeholder:text-[var(--color-fg-subtle)]",
          "focus:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
          "focus:border-[var(--color-accent)] outline-none",
        )}
      />
      {isPending ? (
        <span
          role="status"
          aria-live="polite"
          className="text-2xs font-mono text-[var(--color-fg-subtle)]"
        >
          …
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-2xs font-mono text-[var(--color-red)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function PaletteStrip({ hexes }: { hexes: ReadonlyArray<string> }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="list"
      aria-label={`Palette · ${hexes.length} swatch${hexes.length === 1 ? "" : "es"}`}
    >
      {hexes.slice(0, 8).map((hex, i) => (
        <span
          key={`${i}-${hex}`}
          role="listitem"
          aria-label={hex}
          title={hex}
          className="block w-3 h-3 rounded-sm"
          style={{
            background: hex,
            border: "1px solid var(--color-border-strong)",
          }}
        />
      ))}
    </span>
  );
}
