"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { projectTypes, type Project, type ProjectType } from "@/db/schema";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/Button";

type ParentOption = Pick<Project, "id" | "name" | "type" | "faction">;

type TypeMeta = {
  type: ProjectType;
  blurb: string;
  defaultCount: number;
  acceptsParent: boolean;
};

/**
 * P13.4 — Project type metadata.
 *
 * Sub-project type rule (locked): Army / Warband / Unit parents host
 * only Unit children. Terrain Piece + Diorama stay top-level only.
 * `acceptsParent` is the "can this type sit under an Army/Warband/Unit"
 * flag; when a parent is provided the picker hides anything that can't
 * legally nest.
 */
const TYPE_META: ReadonlyArray<TypeMeta> = [
  {
    type: "Army",
    blurb: "Container for a whole force. Holds child units; counters aggregate up.",
    defaultCount: 0,
    acceptsParent: false,
  },
  {
    type: "Warband",
    blurb: "Smaller skirmish-scale roster — same rules as Army, looser scope.",
    defaultCount: 0,
    acceptsParent: false,
  },
  {
    type: "Unit",
    blurb: "Squad of identical-scheme miniatures — or a single character. The painting workhorse.",
    defaultCount: 10,
    acceptsParent: true,
  },
  {
    type: "Terrain Piece",
    blurb: "Scenery — buildings, ruins, hills. Tracks the same five stages. Top-level only.",
    defaultCount: 1,
    acceptsParent: false,
  },
  {
    type: "Diorama",
    blurb: "Display project. Counts as one composite piece by default. Top-level only.",
    defaultCount: 1,
    acceptsParent: false,
  },
] as const;

const TYPE_META_BY_TYPE: Readonly<Record<ProjectType, TypeMeta>> = Object.freeze(
  Object.fromEntries(TYPE_META.map((m) => [m.type, m])) as Record<
    ProjectType,
    TypeMeta
  >,
);

// Confirm at compile time that every enum member has metadata.
const _allTypesCovered: ReadonlyArray<ProjectType> = projectTypes.map((t) => t);
void _allTypesCovered;

export function NewProjectForm({
  parents,
  initialParentId,
}: {
  parents: ReadonlyArray<ParentOption>;
  initialParentId?: string;
}) {
  // P13.4 — when a parent is pre-selected, the only legal child is Unit.
  const hasInitialParent = Boolean(initialParentId);
  const availableTypes = useMemo<ReadonlyArray<TypeMeta>>(
    () => (hasInitialParent ? TYPE_META.filter((m) => m.acceptsParent) : TYPE_META),
    [hasInitialParent],
  );

  const [type, setType] = useState<ProjectType>(
    hasInitialParent ? "Unit" : "Unit",
  );
  const initialMeta = TYPE_META_BY_TYPE[type];
  const [name, setName] = useState("");
  const [count, setCount] = useState<number>(initialMeta.defaultCount);
  const [parentId, setParentId] = useState<string>(initialParentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const meta = TYPE_META_BY_TYPE[type];
  // Parent picker only renders for types that accept a parent AND when
  // we actually have parents to pick from. Hidden entirely when a
  // parent was pre-supplied (the route param locks the parent).
  const showParentPicker =
    !hasInitialParent && meta.acceptsParent && parents.length > 0;
  const formId = useId();

  const onTypeChange = (next: ProjectType) => {
    setType(next);
    const m = TYPE_META_BY_TYPE[next];
    setCount(m.defaultCount);
    if (!m.acceptsParent) setParentId("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await createProject({
        name: trimmed,
        type,
        count,
        parentId: parentId === "" ? null : parentId,
      });
      // Success path throws via redirect; only reachable on failure.
      if (result && result.ok === false) {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-describedby={`${formId}-err`}>
      <fieldset className="space-y-2">
        <legend className="section-title">Type</legend>
        <div className="space-y-1.5">
          {availableTypes.map((opt) => {
            const checked = opt.type === type;
            return (
              <label
                key={opt.type}
                className={clsx(
                  "flex items-start gap-3 px-3 py-2.5 frame cursor-pointer tap-target",
                  "hover:bg-[color-mix(in_srgb,var(--color-fg)_3%,transparent)]",
                  checked &&
                    "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)]",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={opt.type}
                  checked={checked}
                  onChange={() => onTypeChange(opt.type)}
                  className="sr-only"
                />
                <span
                  className={clsx(
                    "inline-flex items-center justify-center w-3.5 h-3.5 mt-0.5 rounded-full border font-mono text-2xs leading-none",
                    checked
                      ? "border-[var(--color-green)] bg-[color-mix(in_srgb,var(--color-green)_28%,transparent)] text-[var(--color-green)]"
                      : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)]",
                  )}
                  aria-hidden
                >
                  {checked ? "●" : ""}
                </span>
                <span className="min-w-0">
                  <span
                    className={clsx(
                      "block font-mono text-sm uppercase tracking-wide",
                      checked ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]",
                    )}
                  >
                    {opt.type}
                  </span>
                  <span className="block text-xs font-sans text-[var(--color-fg-muted)]">
                    {opt.blurb}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {hasInitialParent ? (
          <p className="text-2xs font-mono text-[var(--color-fg-muted)] mt-1">
            Sub-projects can only be Unit.
          </p>
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor={`${formId}-name`}
          className="block section-title mb-0"
        >
          Name
        </label>
        <input
          id={`${formId}-name`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={120}
          required
          placeholder={
            type === "Army"
              ? "e.g. Salamanders 2k"
              : type === "Unit"
                ? "e.g. Tactical Squad Alpha"
                : "e.g. Ruined Hab Block"
          }
          className="block w-full px-3 py-2.5 font-mono text-sm bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor={`${formId}-count`}
          className="block section-title mb-0"
        >
          Model count
        </label>
        <input
          id={`${formId}-count`}
          type="number"
          min={0}
          max={9999}
          step={1}
          value={count}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            setCount(Number.isFinite(next) && next >= 0 ? next : 0);
          }}
          className={clsx(
            "block w-32 px-3 py-2.5 font-mono text-sm bg-[var(--color-bg-elevated)] frame",
            "focus:border-[var(--color-accent)]",
          )}
        />
        <p className="text-xs font-sans text-[var(--color-fg-muted)]">
          {meta.type === "Army" || meta.type === "Warband"
            ? "0 means the parent has no rank-and-file of its own; counters come from child units."
            : "How many identical-scheme miniatures this project contains. Use 1 for a single character."}
        </p>
      </div>

      {showParentPicker ? (
        <ParentPicker
          formId={formId}
          parents={parents}
          parentId={parentId}
          onChange={setParentId}
        />
      ) : null}

      {error ? (
        <p
          id={`${formId}-err`}
          role="alert"
          className="frame px-3 py-2 text-sm font-mono text-[var(--color-red)] bg-[color-mix(in_srgb,var(--color-red)_8%,transparent)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={isPending}
          variant="success"
          size="sm"
        >
          {isPending ? "Creating…" : "Create project"}
        </Button>
        <Button as="a" href="/projects" variant="ghost" size="sm">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ParentPicker({
  formId,
  parents,
  parentId,
  onChange,
}: {
  formId: string;
  parents: ReadonlyArray<ParentOption>;
  parentId: string;
  onChange: (id: string) => void;
}) {
  const options = useMemo(
    () =>
      parents.map((p) => ({
        id: p.id,
        label: `${p.name} · ${p.type.toUpperCase()}${p.faction ? ` · ${p.faction}` : ""}`,
      })),
    [parents],
  );

  return (
    <div className="space-y-2">
      <label htmlFor={`${formId}-parent`} className="block section-title mb-0">
        Parent (optional)
      </label>
      <select
        id={`${formId}-parent`}
        value={parentId}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full px-3 py-2.5 font-mono text-sm bg-[var(--color-bg-elevated)] frame focus:border-[var(--color-accent)]"
      >
        <option value="">— None (top-level project) —</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="text-xs font-sans text-[var(--color-fg-muted)]">
        Nest this Unit under an Army, Warband, or another Unit to aggregate its counters.
      </p>
    </div>
  );
}
