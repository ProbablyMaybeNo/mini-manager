"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill, type StatusPillKind } from "@/components/ui/StatusPill";
import type { ProjectDashboardRow } from "@/components/ProjectsDashboardTable";
import type { DisplayStatus } from "@/lib/progress";

/**
 * D2 — project-detail inspector (right pane of the master-detail
 * `/projects` workspace, ≥1024).
 *
 * Decisions block (2026-06-03 §2): the right pane shows the SELECTED
 * project's detail (models / recipes / progress) with a **Detail / Focus
 * tab**. The FOCUS bench is the "Focus" tab — NOT the default home state.
 * Selecting a project in the left table swaps the inspector WITHOUT
 * navigation (the workspace owns the selected-id state; the Detail tab
 * renders from the already-loaded row VM, no refetch / no route change).
 *
 * The Detail tab is a summary surface (name, type, status, completion,
 * palette, model count, attached-recipe state) drawn from the row data
 * the dashboard already has in memory — so swapping is instant and adds
 * no nodes. A persistent "Open full project →" link drops to
 * `/projects/[id]` for the deep model tree + colour-scheme editor when
 * the painter actually wants to drill in.
 *
 * The Focus tab is the existing FOCUS bench (FocusPicker + FocusPanel +
 * Stopwatch), passed in as `focusTab` so this pane stays a pure
 * presentational shell. Tabs are reskinned OFF cyan (amber active) per
 * the locked palette / D-plan "reskin active selection off cyan".
 */

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

type InspectorTab = "detail" | "focus";

interface Props {
  /** The currently-selected project's row VM, or null when the painter
   *  hasn't selected one yet (empty detail state). */
  selected: ProjectDashboardRow | null;
  /** The FOCUS bench (FocusPicker + FocusPanel + Stopwatch), rendered as
   *  the Focus tab. Passed from the server page so this pane stays
   *  presentational. */
  focusTab: ReactNode;
}

export function ProjectInspector({ selected, focusTab }: Props) {
  // Detail is the default home state; Focus is the opt-in bench tab.
  const [tab, setTab] = useState<InspectorTab>("detail");
  const detailPanelId = useId();
  const focusPanelId = useId();

  return (
    <div className="frame flex flex-col min-h-0 h-full overflow-hidden">
      {/* Tab strip — Detail (default) / Focus. Reskinned off cyan. */}
      <div
        role="tablist"
        aria-label="Project inspector"
        className="shrink-0 flex border-b border-[var(--color-border)]"
      >
        <InspectorTabButton
          active={tab === "detail"}
          controls={detailPanelId}
          onClick={() => setTab("detail")}
        >
          Detail
        </InspectorTabButton>
        <InspectorTabButton
          active={tab === "focus"}
          controls={focusPanelId}
          onClick={() => setTab("focus")}
        >
          Focus
        </InspectorTabButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tab === "detail" ? (
          <div
            id={detailPanelId}
            role="tabpanel"
            aria-label="Project detail"
          >
            {selected ? (
              <DetailBody row={selected} />
            ) : (
              <EmptyDetail />
            )}
          </div>
        ) : (
          <div id={focusPanelId} role="tabpanel" aria-label="Focus bench">
            {focusTab}
          </div>
        )}
      </div>
    </div>
  );
}

function InspectorTabButton({
  active,
  controls,
  onClick,
  children,
}: {
  active: boolean;
  controls: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={clsx(
        "tap-target px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
        "border-b-2 -mb-px",
        active
          ? "border-[var(--color-amber)] text-[var(--color-amber)]"
          : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
      )}
    >
      {children}
    </button>
  );
}

function DetailBody({ row }: { row: ProjectDashboardRow }) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-mono tracking-wide text-[var(--color-fg)]">
          {row.name}
        </h2>
        <p className="text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          {row.type}
          {row.faction ? ` · ${row.faction}` : ""}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div className="space-y-1">
          <dt className="text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Status
          </dt>
          <dd>
            <StatusPill status={STATUS_PILL[row.status]}>
              {row.status}
            </StatusPill>
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Priority
          </dt>
          <dd className="text-[var(--color-fg-muted)]">
            {row.priority ?? "—"}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Models
          </dt>
          <dd className="tabular-nums text-[var(--color-fg)]">
            {row.totalModels}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Completion
          </dt>
          <dd className="flex items-center gap-2">
            <ProgressBar percent={row.progressPercent} width={28} />
            <span className="tabular-nums text-[var(--color-fg-muted)]">
              {row.progressPercent}%
            </span>
          </dd>
        </div>
      </dl>

      <div className="space-y-1">
        <p className="text-2xs uppercase tracking-wider font-mono text-[var(--color-fg-muted)]">
          Recipes
        </p>
        {row.paletteHexes.length > 0 ? (
          <span
            className="inline-flex items-center gap-1"
            role="list"
            aria-label={`Palette · ${row.paletteHexes.length} swatch${
              row.paletteHexes.length === 1 ? "" : "es"
            }`}
          >
            {row.paletteHexes.slice(0, 12).map((hex, i) => (
              <span
                key={`${i}-${hex}`}
                role="listitem"
                aria-label={hex}
                title={hex}
                className="block w-4 h-4 rounded-sm"
                style={{
                  background: hex,
                  border: "1px solid var(--color-border-strong)",
                }}
              />
            ))}
          </span>
        ) : (
          <p className="text-xs font-sans text-[var(--color-fg-muted)]">
            No recipe attached yet. Open the project to attach one.
          </p>
        )}
      </div>

      <Link
        href={`/projects/${row.id}`}
        className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-[var(--color-amber)] hover:underline"
      >
        Open full project →
      </Link>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="frame p-4 text-center space-y-2">
      <p className="text-sm font-sans text-[var(--color-fg)]">
        Select a project from the list to inspect it here.
      </p>
      <p className="text-xs font-sans text-[var(--color-fg-muted)]">
        Its status, completion, palette, and model count appear in this
        pane — no navigation. Switch to the Focus tab to sit at the bench.
      </p>
    </div>
  );
}
