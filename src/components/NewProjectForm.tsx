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
  countLocked?: boolean;
  acceptsParent: boolean;
};

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
    blurb: "Squad of identical-scheme miniatures. The rank-and-file workhorse.",
    defaultCount: 10,
    acceptsParent: true,
  },
  {
    type: "Single Model",
    blurb: "One distinct miniature — character, hero, or one-off project.",
    defaultCount: 1,
    countLocked: true,
    acceptsParent: true,
  },
  {
    type: "Terrain Piece",
    blurb: "Scenery — buildings, ruins, hills. Tracks the same five stages.",
    defaultCount: 1,
    acceptsParent: true,
  },
  {
    type: "Diorama",
    blurb: "Display project. Counts as one composite piece by default.",
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

export function NewProjectForm({ parents }: { parents: ReadonlyArray<ParentOption> }) {
  const [type, setType] = useState<ProjectType>("Unit");
  const initialMeta = TYPE_META_BY_TYPE[type];
  const [name, setName] = useState("");
  const [count, setCount] = useState<number>(initialMeta.defaultCount);
  const [parentId, setParentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const meta = TYPE_META_BY_TYPE[type];
  const showParentPicker = meta.acceptsParent && parents.length > 0;
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
        count: meta.countLocked ? 1 : count,
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
          {TYPE_META.map((opt) => {
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
                    "font-mono text-xs mt-0.5",
                    checked ? "glow-green" : "text-[var(--color-fg-muted)]",
                  )}
                  aria-hidden
                >
                  {checked ? "[x]" : "[ ]"}
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
              : type === "Single Model"
                ? "e.g. Sergeant Vraks"
                : "e.g. Tactical Squad Alpha"
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
          value={meta.countLocked ? 1 : count}
          disabled={meta.countLocked}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            setCount(Number.isFinite(next) && next >= 0 ? next : 0);
          }}
          className={clsx(
            "block w-32 px-3 py-2.5 font-mono text-sm bg-[var(--color-bg-elevated)] frame",
            "focus:border-[var(--color-accent)]",
            meta.countLocked && "opacity-60 cursor-not-allowed",
          )}
        />
        <p className="text-xs font-sans text-[var(--color-fg-muted)]">
          {meta.countLocked
            ? "Single Model is always 1."
            : meta.type === "Army" || meta.type === "Warband"
              ? "0 means the parent has no rank-and-file of its own; counters come from child units."
              : "How many identical-scheme miniatures this project contains."}
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
          variant="primary"
          size="md"
        >
          {isPending ? "Creating…" : "Create project"}
        </Button>
        <Button as="a" href="/projects" variant="ghost" size="md">
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
        Nest this project under an Army or Warband to aggregate its counters.
      </p>
    </div>
  );
}
