"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlideOutPanel } from "@/components/ui/SlideOutPanel";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import {
  bumpProjectStatus,
  updateProjectName,
  updateProjectPriority,
} from "@/lib/actions/projects";
import { bumpCounter } from "@/lib/actions/counters";
import { setFocusProject } from "@/lib/actions/focus";
import { attachRecipeToProject } from "@/lib/actions/recipes";
import { priorities, type Priority } from "@/db/schema";
import {
  getProjectInspectorData,
  type ProjectInspectorVM,
} from "@/components/projects/projectInspectorActions";

/** Status options the selector can WRITE (bumpProjectStatus enum). */
const STATUS_OPTIONS = [
  "WISHLIST",
  "OWNED",
  "BUILDING",
  "PRIMING",
  "PAINTING",
  "BASING",
  "COMPLETE",
  "SHELVED",
] as const;

/** Completion-bar hue per REBUILD_SPEC §3: cyan in-progress, green at
 *  100%, purple when shelved/on-hold. */
function barColor(vm: ProjectInspectorVM): string {
  if (vm.isShelved) return "var(--color-purple-pastel)";
  if (vm.percent >= 100) return "var(--color-green)";
  return "var(--color-cyan)";
}

/**
 * ProjectInspector — the project-detail slide-out (REBUILD_SPEC §9).
 *
 * Replaces the retired /projects/[id] page: opens whenever a /projects
 * URL carries `?project=<id>` (rows link there; the old detail route
 * 308s there), breadcrumb `SYS > PROJECT`, same black + cyan panel
 * language as the library PAINT INFO panel. Self-contained: reads the
 * param itself and loads its view-model through a server action, so it
 * keeps working no matter how the dashboard page is composed.
 */
export function ProjectInspector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  const [vm, setVm] = useState<ProjectInspectorVM | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const reload = useCallback(
    async (id: string) => {
      const data = await getProjectInspectorData(id);
      setVm(data);
      setNotFound(data === null);
    },
    [setVm],
  );

  useEffect(() => {
    if (!projectId) {
      setVm(null);
      setNotFound(false);
      setError(null);
      setRenaming(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setRenaming(false);
    void getProjectInspectorData(projectId).then((data) => {
      if (cancelled) return;
      setVm(data);
      setNotFound(data === null);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const close = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("project");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  /** Run a mutation, surface its error, then refresh the VM + the page
   *  behind the panel so table rows stay in sync. */
  const mutate = useCallback(
    (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
      setError(null);
      startTransition(async () => {
        const res = await fn();
        if (!res.ok) {
          setError(res.error ?? "Something went wrong");
          return;
        }
        await reload(id);
        router.refresh();
      });
    },
    [reload, router],
  );

  if (!projectId) return null;

  return (
    <SlideOutPanel
      open
      onClose={close}
      breadcrumb="SYS &gt; PROJECT"
      title={vm?.name ?? (notFound ? "NOT FOUND" : "PROJECT")}
      width={360}
    >
      {vm === null ? (
        notFound ? (
          <div className="space-y-4">
            <p className="font-mono text-sm text-[var(--color-red)]" role="alert">
              ▸ PROJECT NOT FOUND — it may have been deleted.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Close
            </Button>
          </div>
        ) : (
          <p
            className="font-mono text-sm text-[var(--color-cyan)]"
            role="status"
            aria-live="polite"
          >
            ▸ LOADING PROJECT…
          </p>
        )
      ) : (
        <div className="space-y-6">
          {/* Identity — type / faction line under the panel title. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-chip type-chip-cyan">{vm.type}</span>
            {vm.faction ? (
              <span className="font-mono text-sm text-[var(--color-fg-muted)]">
                {vm.faction}
              </span>
            ) : null}
          </div>

          {/* FOCUS — the primary action (REBUILD_SPEC §0.1: focus is a
              full page launched from dashboard rows / this inspector). */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full justify-center"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await setFocusProject({ projectId: vm.id });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                router.push(`/focus?project=${encodeURIComponent(vm.id)}`);
              });
            }}
          >
            ► FOCUS
          </Button>

          {error ? (
            <p className="font-mono text-xs text-[var(--color-red)]" role="alert">
              ▸ {error}
            </p>
          ) : null}

          {/* STATUS / PRIORITY selectors. */}
          <section className="space-y-3">
            <h3 className="section-title text-[var(--color-cyan)]">Status</h3>
            <SelectField
              label="Status"
              value={vm.status}
              disabled={isPending}
              onChange={(e) =>
                mutate(vm.id, () =>
                  bumpProjectStatus({
                    id: vm.id,
                    status: e.target.value as (typeof STATUS_OPTIONS)[number],
                  }),
                )
              }
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Priority"
              value={vm.priority ?? ""}
              disabled={isPending}
              onChange={(e) =>
                mutate(vm.id, () =>
                  updateProjectPriority({
                    id: vm.id,
                    priority:
                      e.target.value === ""
                        ? null
                        : (e.target.value as Priority),
                  }),
                )
              }
            >
              <option value="">— NONE —</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </SelectField>
          </section>

          {/* COMPLETION — the (- n/N +) counter on the complete stage +
              the segmented bar idiom from the dashboard table. */}
          <section className="space-y-3">
            <h3 className="section-title text-[var(--color-cyan)]">
              Completion
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  mutate(vm.id, () =>
                    bumpCounter({
                      projectId: vm.id,
                      stage: "complete",
                      delta: -1,
                    }),
                  )
                }
                disabled={isPending || vm.completeCount <= 0}
                aria-label="Decrease completed models"
                className="tap-target inline-flex h-11 w-11 items-center justify-center border border-[var(--color-cyan)] font-mono text-lg text-[var(--color-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-cyan)_15%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                −
              </button>
              <p className="min-w-[5ch] text-center font-mono text-lg text-[var(--color-fg)] tabular-nums">
                {vm.completeCount}/{vm.count}
              </p>
              <button
                type="button"
                onClick={() =>
                  mutate(vm.id, () =>
                    bumpCounter({
                      projectId: vm.id,
                      stage: "complete",
                      delta: 1,
                    }),
                  )
                }
                disabled={isPending || vm.completeCount >= vm.count}
                aria-label="Increase completed models"
                className="tap-target inline-flex h-11 w-11 items-center justify-center border border-[var(--color-cyan)] font-mono text-lg text-[var(--color-cyan)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-cyan)_15%,transparent)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                +
              </button>
              <span className="ml-auto font-mono text-sm text-[var(--color-fg-muted)] tabular-nums">
                {vm.percent}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Project completion"
              aria-valuenow={vm.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full border border-[var(--color-border)]"
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, Math.max(0, vm.percent))}%`,
                  backgroundColor: barColor(vm),
                }}
              />
            </div>
          </section>

          {/* RECIPES — attached chips + the ASSIGN dropdown. */}
          <section className="space-y-3">
            <h3 className="section-title text-[var(--color-cyan)]">Recipes</h3>
            {vm.recipes.length === 0 ? (
              <p className="font-mono text-sm text-[var(--color-fg-muted)]">
                ▸ NO RECIPE ASSIGNED
              </p>
            ) : (
              <ul className="space-y-2">
                {vm.recipes.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="flex shrink-0 gap-[2px]" aria-hidden>
                      {r.hexes.map((hex, i) => (
                        <span
                          key={`${hex}-${i}`}
                          className="h-4 w-4 border border-black/40"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </span>
                    <Link
                      href={`/recipes/${r.id}`}
                      className="tap-target flex min-w-0 items-center font-mono text-sm text-[var(--color-cyan)] underline-offset-2 hover:underline"
                    >
                      <span className="truncate">{r.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {vm.attachCandidates.length > 0 ? (
              <SelectField
                label="Assign recipe"
                value=""
                disabled={isPending}
                onChange={(e) => {
                  const recipeId = e.target.value;
                  if (!recipeId) return;
                  mutate(vm.id, () =>
                    attachRecipeToProject({ recipeId, projectId: vm.id }),
                  );
                }}
              >
                <option value="">+ ASSIGN…</option>
                {vm.attachCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.attachedToName ? ` (moves from ${c.attachedToName})` : ""}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </section>

          {/* UNITS — imported army-list / sub-project summary. */}
          {vm.children.length > 0 ? (
            <section className="space-y-2">
              <h3 className="section-title text-[var(--color-cyan)]">
                Units ({vm.children.length})
              </h3>
              <ul className="space-y-1">
                {vm.children.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--color-border)] pb-1 font-mono text-sm"
                  >
                    <span className="min-w-0 truncate text-[var(--color-fg)]">
                      {c.name}
                      {c.count > 0 ? (
                        <span className="text-[var(--color-fg-muted)] tabular-nums">
                          {" "}
                          ×{c.count}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--color-green)] tabular-nums">
                      {c.status} {c.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* EDIT (inline rename) + DELETE (red). */}
          <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
            {renaming ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = nameDraft.trim();
                  if (!name) return;
                  mutate(vm.id, async () => {
                    const res = await updateProjectName({ id: vm.id, name });
                    if (res.ok) setRenaming(false);
                    return res;
                  });
                }}
              >
                <TextField
                  label="Project name"
                  name="projectName"
                  required
                  maxLength={120}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isPending || nameDraft.trim().length === 0}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRenaming(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNameDraft(vm.name);
                    setRenaming(true);
                  }}
                  disabled={isPending}
                >
                  Edit name
                </Button>
                <DeleteProjectButton
                  projectId={vm.id}
                  projectName={vm.name}
                  redirectToProjectsOnSuccess
                  label="Delete"
                />
              </div>
            )}
          </section>
        </div>
      )}
    </SlideOutPanel>
  );
}
