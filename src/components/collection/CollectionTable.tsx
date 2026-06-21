"use client";

import { useMemo, useState } from "react";
import { Button, Chip, CloseButton, EmptyState, Listbox, SwatchStrip } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { CollectionItem, CollectionKind, Project, ProjectStatus } from "@/lib/types";
import { StatusDropdown } from "./StatusDropdown";

/** Coarse status buckets the filter panel exposes (2OWF: Wishlist/Owned/Hold). */
type StatusFilter = "WISHLIST" | "OWNED" | "HOLD";
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "WISHLIST", label: "Wishlist" },
  { value: "OWNED", label: "Owned" },
  { value: "HOLD", label: "Hold" },
];

/** Map a fine ProjectStatus onto its coarse filter bucket. Everything
 *  past OWNED in the build lifecycle still counts as "owned". */
function statusBucket(s: ProjectStatus): StatusFilter {
  if (s === "WISHLIST") return "WISHLIST";
  if (s === "SHELVED") return "HOLD";
  return "OWNED";
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-10 w-10 border border-cyan/30 object-cover" />;
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center border border-cyan/30 bg-bg-raised/40 font-body text-body text-fg-faint">
      ▦
    </span>
  );
}

const PAINT_COLS = ["Image", "Name", "Company", "Vendor", "Type", "Price", "Recipe", "Status", "Link", ""];
const MODEL_COLS = ["Image", "Name", "Game", "Army", "Price", "Project", "Status", "Link", ""];

export function CollectionTable({
  kind,
  items,
  projects,
  onStatusChange,
  onAssignProject,
  onAttachRecipe,
  onRemove,
  onAdd,
  recipeSwatches,
}: {
  kind: CollectionKind;
  items: CollectionItem[];
  projects: Project[];
  onStatusChange: (item: CollectionItem, status: ProjectStatus) => void;
  onAssignProject: (item: CollectionItem, projectId: string) => void;
  onAttachRecipe: (item: CollectionItem) => void;
  onRemove: (item: CollectionItem) => void;
  onAdd: () => void;
  recipeSwatches?: (recipeId: string) => string[];
}) {
  const cols = kind === "paint" ? PAINT_COLS : MODEL_COLS;
  const label = kind === "paint" ? "Paint" : "Model";
  const title = kind === "paint" ? "PAINTS" : "MODELS";

  const [filterOpen, setFilterOpen] = useState(false);
  // Empty set = no filter (show all); otherwise show only matching buckets.
  const [active, setActive] = useState<Set<StatusFilter>>(new Set());

  const visible = useMemo(
    () => (active.size === 0 ? items : items.filter((i) => active.has(statusBucket(i.status)))),
    [items, active],
  );

  function toggleFilter(f: StatusFilter) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  // Active projects only (wyeWv): a model can't be assigned to a finished
  // or shelved project, and we never list the wishlist placeholder.
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "COMPLETE" && p.status !== "SHELVED"),
    [projects],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header row — title + count on the left, Filter button far right (KpdEP). */}
      <div className="flex items-center justify-between gap-3">
        {/* h2 (not h3) so the /collection outline reads h1 → h2 with no skipped
            level — the page h1 is "COLLECTION" (UX-005). Visual styling kept. */}
        <h2 className="label-osd text-cyan">
          {title} <span className="text-fg">{items.length}</span>
        </h2>
        <div className="relative">
          <Button
            variant={active.size > 0 ? "primary" : "secondary"}
            size="sm"
            aria-expanded={filterOpen}
            aria-label={`Filter ${label.toLowerCase()} table`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            ▾ Filter{active.size > 0 ? ` (${active.size})` : ""}
          </Button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-2 w-48 border border-purple bg-bg p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
              style={{ borderRadius: "var(--radius-panel)" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="label-osd text-fg">
                  {title} · Status
                </span>
                {active.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setActive(new Set())}
                    className="font-body text-body text-red hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-1.5">
                {STATUS_FILTERS.map((f) => (
                  <li key={f.value}>
                    <label className="flex cursor-pointer items-center gap-2 font-body text-body text-fg">
                      <input
                        type="checkbox"
                        checked={active.has(f.value)}
                        onChange={() => toggleFilter(f.value)}
                        className="accent-purple"
                      />
                      {f.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* x-auto only as a fallback; columns are sized to fit so no scroll
          is needed at normal widths (77YGg). */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-cyan/30">
              {cols.map((c, i) => (
                <th
                  key={c || `c${i}`}
                  scope="col"
                  className="px-3 py-2 text-left label-osd tracking-[0.18em] text-fg"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-3 py-4">
                  <EmptyState
                    glyph={kind === "paint" ? "▤" : "◈"}
                    title={
                      items.length === 0
                        ? `No ${label.toLowerCase()}s yet`
                        : "No matches for this filter"
                    }
                    hint={
                      items.length === 0
                        ? `Paste a store URL above, or add your first ${label.toLowerCase()} by hand.`
                        : "Adjust the status filter to see more."
                    }
                    action={
                      items.length === 0
                        ? { label: `+ Add ${label.toLowerCase()}`, onClick: onAdd, variant: "add" as const }
                        : undefined
                    }
                    className="py-8"
                  />
                </td>
              </tr>
            ) : (
              visible.map((item, rowIndex) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-fg/10 transition-colors hover:bg-cyan/5",
                    // Subtle zebra banding so dense rows separate without
                    // relying purely on the hairline borders (UX-015).
                    rowIndex % 2 === 1 && "bg-fg/[0.02]",
                  )}
                >
                  <td className="px-3 py-2">
                    <Thumb src={item.thumbnail} alt={item.name} />
                  </td>
                  <td className="px-3 py-2">
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-body font-medium text-fg hover:text-cyan hover:underline"
                      >
                        {item.name}
                      </a>
                    ) : (
                      <span className="font-body text-body font-medium text-fg">{item.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-body text-body text-fg">
                    {kind === "model" ? (item.game ?? "") : item.company}
                  </td>
                  <td className="px-3 py-2 font-body text-body text-fg">
                    {kind === "model" ? (item.army ?? "") : item.vendor}
                  </td>
                  {kind === "paint" && (
                    <td className="px-3 py-2">
                      {item.paintType ? (
                        <Chip accent="dim">{item.paintType}</Chip>
                      ) : (
                        <span className="font-body text-body text-fg-faint">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 font-body text-body tabular-nums text-fg">{item.price}</td>
                  {kind === "paint" ? (
                    <td className="px-3 py-2">
                      <SwatchStrip
                        swatches={item.recipeId ? (recipeSwatches?.(item.recipeId) ?? []) : []}
                        onAttach={() => onAttachRecipe(item)}
                      />
                    </td>
                  ) : (
                    <td className="px-3 py-2">
                      <Listbox
                        value={item.projectId ?? ""}
                        ariaLabel={`Assign ${item.name} to a project`}
                        accent="purple"
                        placeholder="— Unassigned —"
                        onChange={(v) => onAssignProject(item, v)}
                        options={[
                          { value: "", label: "— Unassigned —" },
                          ...activeProjects.map((p) => ({ value: p.id, label: p.title })),
                        ]}
                        triggerClassName="max-w-[160px]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <StatusDropdown
                      kind={kind}
                      value={item.status}
                      ariaLabel={`Status for ${item.name}`}
                      onChange={(s) => onStatusChange(item, s)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open source for ${item.name}`}
                        className="font-body text-body text-cyan underline-offset-2 hover:underline"
                      >
                        link
                      </a>
                    ) : (
                      <span className="font-body text-body text-fg-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CloseButton
                      tone="destructive"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => onRemove(item)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Restyled add button — shared kit Button (R493). Neon green, the
          collection accent the painter confirmed (MM-37/38/42/43). */}
      <div className="flex border-t border-cyan/20 pt-3">
        <Button variant="add" size="sm" onClick={onAdd}>
          + Add {label.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
