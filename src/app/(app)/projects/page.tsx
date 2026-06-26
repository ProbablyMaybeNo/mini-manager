"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Listbox, Panel, SearchField } from "@/components/kit";
import { PageHeader } from "@/components/shell";
import { useMockData } from "@/mock/MockProvider";
import { STATUS_LABEL } from "@/lib/palette";
import {
  applyProjectFilters,
  DEFAULT_PROJECT_FILTERS,
  hasActiveFilters,
  type ProjectFilters,
  type ProjectSort,
} from "@/lib/projectFilter";
import type { Priority, Project, ProjectStatus, ProjectType } from "@/lib/types";
import { ProjectsTable } from "@/components/dashboard/ProjectsTable";
import { ProjectPanelStack } from "@/components/dashboard/ProjectPanelStack";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = (
  [
    "WISHLIST",
    "OWNED",
    "BUILDING",
    "PRIMING",
    "PAINTING",
    "BASING",
    "COMPLETE",
    "SHELVED",
  ] as ProjectStatus[]
).map((s) => ({ value: s, label: STATUS_LABEL[s] }));

const TYPE_OPTIONS: { value: ProjectType; label: string }[] = (
  ["Army", "Warband", "Unit", "Model", "Terrain"] as ProjectType[]
).map((t) => ({ value: t, label: t }));

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = (
  ["High", "Med", "Low"] as Priority[]
).map((p) => ({ value: p, label: p }));

const SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "completion", label: "Completion %" },
  { value: "priority", label: "Priority" },
  { value: "updated", label: "Recently updated" },
];

/**
 * DOP-017 — the real `/projects` management list. The power-user roster: every
 * army/warband/model you track, with the search + filter + sort the dashboard
 * deliberately lacks. No welcome card / stat strip / calendar — just the
 * filterable list. Reuses ProjectsTable (desktop table + mobile cards, all row
 * actions) and the same ProjectPanelStack inspector the dashboard drives.
 */
function ProjectsRoute() {
  const data = useMockData();
  const router = useRouter();

  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_PROJECT_FILTERS);
  const set = <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Inspector wiring mirrors the dashboard: a selected id drives the
  // ProjectPanelStack. The inspector reads the FULL tree (so sub-project tabs
  // resolve even when a child is filtered out of the visible list).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const visible = useMemo(
    () => applyProjectFilters(data.projects, filters),
    [data.projects, filters],
  );

  function openProject(p: Project) {
    setSelectedId(p.id);
    setInspectorOpen(true);
  }

  const filtered = hasActiveFilters(filters);

  return (
    <div className="flex h-full bg-black">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
        <PageHeader
          title="PROJECTS"
          tagline="// every army, warband & model you're tracking"
        />

        <Panel label="ROSTER" cornerTicks className="mt-6 p-4">
          {/* Controls — search + three filter dropdowns + sort. The Listboxes
              carry an explicit "Any …" option so clearing a filter is one tap
              (value "" maps back to null). */}
          <div className="flex flex-col gap-3 border-b border-cyan/20 pb-4 md:flex-row md:flex-wrap md:items-end">
            <SearchField
              label="Search"
              aria-label="Search projects by name"
              value={filters.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search by name…"
              containerClassName="md:w-56"
            />
            <FilterListbox
              label="Status"
              value={filters.status ?? ""}
              options={STATUS_OPTIONS}
              anyLabel="Any status"
              onChange={(v) => set("status", (v || null) as ProjectStatus | null)}
            />
            <FilterListbox
              label="Type"
              value={filters.type ?? ""}
              options={TYPE_OPTIONS}
              anyLabel="Any type"
              onChange={(v) => set("type", (v || null) as ProjectType | null)}
            />
            <FilterListbox
              label="Priority"
              value={filters.priority ?? ""}
              options={PRIORITY_OPTIONS}
              anyLabel="Any priority"
              onChange={(v) => set("priority", (v || null) as Priority | null)}
            />
            <FilterListbox
              label="Sort"
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(v) => set("sort", (v || "name") as ProjectSort)}
            />
            {filtered && (
              <Button
                variant="tertiary"
                size="sm"
                className="md:ml-auto"
                onClick={() => setFilters(DEFAULT_PROJECT_FILTERS)}
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="pt-4">
            {visible.length === 0 && filtered ? (
              <EmptyState
                glyph="⌕"
                title="No projects match"
                hint="No project matches the current search and filters. Loosen them to see more of your roster."
                action={{
                  label: "Clear filters",
                  onClick: () => setFilters(DEFAULT_PROJECT_FILTERS),
                  variant: "secondary",
                }}
              />
            ) : (
              <ProjectsTable
                projects={visible}
                projectMinutes={data.projectMinutes}
                selectedId={selectedId ?? undefined}
                onOpenProject={openProject}
                onFocusProject={(p) => router.push(`/focus?project=${p.id}`)}
                onAttachRecipe={() => router.push("/recipes")}
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Same inspector the dashboard drives — desktop in-flow pane / mobile
          overlay (handled inside ProjectPanelStack). Reads the full tree so
          sub-project tabs resolve even when a child is filtered from view. */}
      <ProjectPanelStack
        projects={data.projects}
        rootId={selectedId}
        projectMinutes={data.projectMinutes}
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        onStartSession={(p) => {
          setInspectorOpen(false);
          router.push(`/focus?project=${p.id}`);
        }}
        onAttachRecipe={() => router.push("/recipes")}
      />
    </div>
  );
}

/** A labelled filter dropdown with a leading "Any …" clear option. */
function FilterListbox<T extends string>({
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  label: string;
  value: T | "";
  options: { value: T; label: string }[];
  anyLabel?: string;
  onChange: (value: T | "") => void;
}) {
  const opts = anyLabel
    ? [{ value: "" as T, label: anyLabel }, ...options]
    : options;
  return (
    <label className="flex flex-col gap-1 md:w-44">
      <span className="label-osd text-fg">{label}</span>
      <Listbox<T>
        value={value}
        options={opts}
        onChange={onChange}
        ariaLabel={label}
        className="w-full"
        triggerClassName="w-full"
      />
    </label>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsRoute />
    </Suspense>
  );
}
