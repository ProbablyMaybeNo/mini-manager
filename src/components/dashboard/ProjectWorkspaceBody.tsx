"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmDialog,
  DateField,
  Input,
  Listbox,
  PriorityTag,
  ProgressBar,
  StatusText,
  Swatch,
  TypeChip,
} from "@/components/kit";
import {
  bumpProjectStatus,
  createProject,
  deleteProject,
  setProjectComplete,
  updateProjectPriority,
} from "@/lib/actions/projects";
import {
  loadProjectDetail,
  setProjectReferenceImage,
  setProjectTargetDate,
  updateProjectNotes,
  type ProjectDetail,
} from "@/lib/actions/projectMeta";
import { cn } from "@/lib/cn";
import { formatMinutes, priorityAccent, statusAccent, STATUS_LABEL } from "@/lib/palette";
import type { Priority, Project, ProjectStatus } from "@/lib/types";

const STATUS_OPTIONS: ProjectStatus[] = [
  "WISHLIST",
  "OWNED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
  "SHELVED",
];
const PRIORITY_OPTIONS: Priority[] = ["Low", "Med", "High"];
/** App display priority → DB priority enum (updateProjectPriority input). */
const PRIORITY_TO_DB: Record<Priority, "Low" | "Medium" | "High"> = {
  Low: "Low",
  Med: "Medium",
  High: "High",
};
/** Child types selectable when adding a sub-project. These literals are valid
 *  in both the app ProjectType and the DB projectTypes enum. */
const SUBPROJECT_TYPES = ["Unit", "Model"] as const;
type SubProjectType = (typeof SUBPROJECT_TYPES)[number];

function Section({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="label-osd text-cyan">
        {label}
      </h3>
      {hint && <p className="-mt-1 font-body text-body text-fg">{hint}</p>}
      {children}
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border border-cyan/20 px-2 py-3">
      <span className="font-num2 text-num2 text-fg tabular-nums">{value}</span>
      <span className="label-osd text-fg">
        {label}
      </span>
    </div>
  );
}

export function ProjectWorkspaceBody({
  project,
  loggedMinutes,
  onAttachRecipe,
  onStartSession,
  onClose,
  variant = "panel",
}: {
  project: Project;
  /** Logged minutes for this project + sub-projects (UX-011). Shown as a Time
   *  stat, formatted like the Focus per-project time. */
  loggedMinutes?: number;
  onAttachRecipe?: (project: Project) => void;
  onStartSession?: (project: Project) => void;
  onClose?: () => void;
  variant?: "panel" | "page";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable notes / target date / reference image — seeded from the detail
  // fetch, then owned locally so typing is responsive.
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [refUrl, setRefUrl] = useState("");

  // Add-sub-project inline form.
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childType, setChildType] = useState<SubProjectType>("Unit");
  const [childCount, setChildCount] = useState(1);

  const children = project.children ?? [];

  useEffect(() => {
    let alive = true;
    setDetail(null);
    loadProjectDetail(project.id)
      .then((d) => {
        if (!alive || !d) return;
        setDetail(d);
        setNotes(d.notes ?? "");
        setTargetDate(d.targetDate ?? "");
        setRefUrl(d.referenceImageUrl ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [project.id]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  function addChild(e: FormEvent) {
    e.preventDefault();
    if (!childName.trim()) return;
    run(async () => {
      const res = await createProject({
        name: childName.trim(),
        type: childType,
        parentId: project.id,
        count: Math.max(1, childCount),
      });
      if (res.ok) {
        setChildName("");
        setChildCount(1);
        setAddingChild(false);
      }
      return res;
    });
  }

  // On the standalone /projects/[id] page this title is the document's primary
  // heading, so it must be an h1 (the page has no other) — UX-001. In the
  // dashboard slide-out the SlideOutPanel header already supplies the dialog
  // title, so the inspector keeps an h2. Visual class is identical either way:
  // semantic level is decoupled from the font-h1 sizing.
  const TitleTag = variant === "page" ? "h1" : "h2";

  return (
    <div className="flex flex-col gap-5">
      {/* Project name */}
      <TitleTag className="font-h1 text-h1 text-green text-glow-green">
        {project.title}
      </TitleTag>

      {/* Meta row: type · status · priority · progress */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1 border border-cyan/20 p-2">
          <span className="label-osd text-fg">
            Type
          </span>
          <TypeChip type={project.type} />
        </div>
        <div className="flex flex-col gap-1 border border-cyan/20 p-2">
          <span className="label-osd text-fg">
            Status
          </span>
          <Listbox
            value={project.status}
            disabled={pending}
            ariaLabel="Project status"
            accent={statusAccent[project.status]}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            onChange={(s) =>
              run(() => bumpProjectStatus({ id: project.id, status: s }))
            }
          />
        </div>
        <div className="flex flex-col gap-1 border border-cyan/20 p-2">
          <span className="label-osd text-fg">
            Priority
          </span>
          {/* PRIORITY matches STATUS/TYPE (U3vAGGyt-AjD): same accent-tinted,
              UPPERCASE Listbox treatment as the Status control above. */}
          <Listbox
            value={project.priority}
            disabled={pending}
            ariaLabel="Project priority"
            accent={priorityAccent[project.priority]}
            options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p.toUpperCase() }))}
            onChange={(p) =>
              run(() =>
                updateProjectPriority({
                  id: project.id,
                  priority: PRIORITY_TO_DB[p],
                }),
              )
            }
          />
        </div>
        {/* Overall-progress KPI stripped to a centered percentage number only
            (S3lZ40vuocCL) — the label + bar chrome Ross flagged as too busy is
            dropped; the number stays a Number-1 category readout. */}
        <div className="flex items-center justify-center border border-cyan/20 p-2">
          <span className="font-num1 text-num1 leading-none text-fg tabular-nums">
            {project.completionPercent}%
          </span>
        </div>
      </div>

      {(detail?.faction || detail?.game) && (
        <p className="font-body text-body text-fg">
          {[detail.faction, detail.game].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* Recipe */}
      <Section label="Recipe">
        <div className="flex flex-wrap items-center gap-2">
          {project.recipeSwatches.map((hex, i) => (
            <Swatch key={`${hex}-${i}`} hex={hex} size="lg" />
          ))}
          <Button
            variant="add"
            size="sm"
            onClick={() => onAttachRecipe?.(project)}
          >
            + Paint
          </Button>
        </div>
      </Section>

      {/* Stat row — gains a fourth Time cell when logged time is provided
          (UX-011), formatted like the Focus per-project time. */}
      <div className={cn("grid gap-2", loggedMinutes != null ? "grid-cols-4" : "grid-cols-3")}>
        <StatCell label="Total models" value={project.modelCount ?? 0} />
        <StatCell label="Completed" value={project.modelsComplete ?? 0} />
        <StatCell label="Sub-projects" value={children.length} />
        {loggedMinutes != null && (
          <StatCell label="Time" value={formatMinutes(loggedMinutes)} />
        )}
      </div>

      {/* Sub-projects */}
      <Section
        label="Sub-projects"
        hint="Army progress increases as models in each unit are marked completed."
      >
        {children.length > 0 ? (
          <div className="overflow-x-auto">
            {/* min-w so the wrapper scrolls instead of compressing + clipping
                the PRIORITY/Progress columns at narrow widths (UX-002). */}
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-cyan/30 label-osd text-fg">
                  <th className="py-1 pr-2">Name</th>
                  <th className="px-1">Type</th>
                  <th className="px-1">Status</th>
                  <th className="px-1">Priority</th>
                  <th className="px-1 text-center">Done</th>
                  <th className="px-1 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => {
                  const total = c.modelCount ?? 0;
                  const done = c.modelsComplete ?? 0;
                  return (
                    <tr key={c.id} className="border-b border-fg/10 font-body text-body">
                      <td className="py-1.5 pr-2 text-fg">{c.title}</td>
                      <td className="px-1">
                        <TypeChip type={c.type} />
                      </td>
                      <td className="px-1">
                        <StatusText status={c.status} />
                      </td>
                      <td className="px-1">
                        <PriorityTag priority={c.priority} />
                      </td>
                      <td className="px-1">
                        <div className="flex items-center justify-center gap-1 tabular-nums">
                          <button
                            type="button"
                            aria-label={`Decrease completed for ${c.title}`}
                            disabled={pending || done <= 0}
                            onClick={() =>
                              run(() =>
                                setProjectComplete({
                                  id: c.id,
                                  complete: Math.max(0, done - 1),
                                }),
                              )
                            }
                            className="inline-flex min-h-6 min-w-6 items-center justify-center font-button text-button border border-cyan/40 px-1 text-cyan hover:bg-cyan/10 disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="font-num2 text-num2 min-w-[2.5rem] text-center text-fg">
                            {done}/{total}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase completed for ${c.title}`}
                            disabled={pending || (total > 0 && done >= total)}
                            onClick={() =>
                              run(() =>
                                setProjectComplete({
                                  id: c.id,
                                  complete: done + 1,
                                }),
                              )
                            }
                            className="inline-flex min-h-6 min-w-6 items-center justify-center font-button text-button border border-cyan/40 px-1 text-cyan hover:bg-cyan/10 disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-1">
                        <ProgressBar percent={c.completionPercent} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-body text-body text-fg">No sub-projects yet.</p>
        )}

        {addingChild ? (
          <form onSubmit={addChild} className="mt-2 flex flex-wrap items-end gap-2">
            <Input
              label="Sub-project name"
              name="child-name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Intercessor Squad"
            />
            <select
              value={childType}
              onChange={(e) => setChildType(e.target.value as SubProjectType)}
              aria-label="Sub-project type"
              className="border border-cyan/50 bg-bg px-2 py-1.5 font-body text-body text-fg focus:outline-none"
            >
              {SUBPROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex flex-col gap-1">
              <span className="label-osd text-fg">
                Models
              </span>
              <input
                type="number"
                min={1}
                value={childCount}
                onChange={(e) => setChildCount(Number(e.target.value) || 1)}
                aria-label="Sub-project model count"
                className="w-16 border border-cyan/50 bg-bg px-2 py-1.5 font-num2 text-num2 text-fg focus:outline-none"
              />
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              Add
            </Button>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => setAddingChild(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            variant="add"
            size="sm"
            className="mt-1 self-start"
            onClick={() => setAddingChild(true)}
          >
            + Sub-project
          </Button>
        )}
      </Section>

      {/* Notes + target date */}
      <Section label="Notes & deadline">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() =>
            run(() => updateProjectNotes({ id: project.id, notes }))
          }
          rows={3}
          placeholder="Focus next on Terminators edge highlights…"
          className="w-full resize-y border border-cyan/40 bg-bg px-3 py-2 font-body text-body text-fg focus:border-cyan focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="label-osd text-fg">
            Target date
          </span>
          <DateField
            value={targetDate}
            ariaLabel="Target date"
            onChange={(v) => {
              setTargetDate(v);
              run(() => setProjectTargetDate({ id: project.id, date: v || null }));
            }}
          />
        </div>
      </Section>

      {/* Reference image */}
      <Section label="Reference image">
        {refUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={refUrl}
            alt={`${project.title} reference`}
            className="max-h-48 w-full border border-cyan/30 object-contain"
          />
        )}
        <div className="flex gap-2">
          <Input
            name="reference-url"
            value={refUrl}
            onChange={(e) => setRefUrl(e.target.value)}
            placeholder="https://…/reference.jpg"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                setProjectReferenceImage({ id: project.id, url: refUrl || null }),
              )
            }
          >
            Save
          </Button>
        </div>
      </Section>

      {error && <p className="font-body text-body text-red">▸ {error}</p>}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-cyan/20 pt-4">
        {onStartSession && (
          <Button size="sm" onClick={() => onStartSession(project)}>
            ▸ Focus
          </Button>
        )}
        {variant === "panel" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            ⤢ Open full page
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
        >
          🗑 Delete
        </Button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        breadcrumb="PROJECT"
        title="Delete project?"
        message={`Delete "${project.title}" and its sub-projects? This can't be undone.`}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          run(async () => {
            const res = await deleteProject({ id: project.id });
            if (res.ok) onClose?.();
            return res;
          });
        }}
      />
    </div>
  );
}
