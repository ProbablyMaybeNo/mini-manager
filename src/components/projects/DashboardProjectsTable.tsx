"use client";

import { useMemo, useState } from "react";
import {
  ProjectsDashboardTable,
  type ProjectDashboardRow,
} from "@/components/ProjectsDashboardTable";
import { Button } from "@/components/ui/Button";

/**
 * FOCUS-DASH (2026-06-04) — full-width PROJECTS table for the DASHBOARD.
 *
 * Replaces the D2 master-detail split: the IA restructure intentionally
 * unwinds the two-pane workspace + the detail inspector (detail-focus is
 * gone, rows already navigate to the project page) so the table spans the
 * full width on every breakpoint.
 *
 * This thin client shell keeps the only piece of the old workspace worth
 * preserving — the name/faction filter — and hands the filtered rows to
 * the existing `ProjectsDashboardTable` (single owner of the table; the
 * dense desktop table + the M3 mobile comparison table both live inside
 * it, so there's no double-mount).
 */
interface Props {
  rows: ReadonlyArray<ProjectDashboardRow>;
  ownedRecipes: ReadonlyArray<{
    id: string;
    name: string;
    attachedProjectId: string | null;
  }>;
  projectNameById: Readonly<Record<string, string>>;
  /** UX-006 — the pinned Focus project id; its row gets the persistent
   *  cyan "active line" highlight. Null when no focus is set. */
  focusProjectId?: string | null;
}

export function DashboardProjectsTable({
  rows,
  ownedRecipes,
  projectNameById,
  focusProjectId = null,
}: Props) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Match on name OR faction so the tree stays navigable.
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.faction ? r.faction.toLowerCase().includes(q) : false),
    );
  }, [rows, query]);

  return (
    <div className="space-y-3">
      {/* PHASE-1 cohesion — the filter reads as a terminal command prompt:
          a cyan ▸ prompt + a phosphor-tinted frame that matches the
          mission table's border. */}
      <label
        className="rounded-sm border flex items-center gap-2 px-3 py-2 min-h-[44px] md:min-h-[36px] focus-within:border-[var(--color-cyan)] transition-colors"
        style={{
          borderColor:
            "color-mix(in srgb, var(--color-cyan) 22%, var(--color-border))",
        }}
      >
        <span aria-hidden className="font-mono text-xs text-[var(--color-cyan)]">
          ▸
        </span>
        <span className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Filter
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter projects by name…"
          aria-label="Filter projects by name"
          className="flex-1 bg-transparent font-mono text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none"
        />
      </label>
      <ProjectsDashboardTable
        rows={filteredRows}
        ownedRecipes={ownedRecipes}
        projectNameById={projectNameById}
        focusProjectId={focusProjectId}
      />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button as="a" href="/projects/new" variant="primary" size="sm">
          Add project
        </Button>
        <Button
          as="a"
          href="/projects/import"
          variant="tertiary"
          tone="outline"
          size="sm"
        >
          Upload army list
        </Button>
      </div>
    </div>
  );
}
