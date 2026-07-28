"use client";

import { useMemo, useState } from "react";
import { PenLine, Trash2 } from "lucide-react";
import { Listbox } from "@/components/kit";
import { cn } from "@/lib/cn";
import { statusAccent, accentText } from "@/lib/palette";
import type { CollectionItem, CollectionKind, Project, ProjectStatus } from "@/lib/types";
import { StatusDropdown } from "./StatusDropdown";

/* ---------------------------------------------------------------------------
 * 24:4 collection table — faithful rebuild of paints-container (24:62) /
 * models-container (24:281). Each section is a chip-filtered, ghost-footed
 * table with the frame's exact column set:
 *   PAINTS  : ☐ · SW · NAME · BRAND · TYPE · QTY · PRICE · PROJECT · STATUS · ACTIONS
 *   MODELS  : ☐ · NAME · TYPE · QTY · PRICE · PROJECT · STATUS · TIME SPENT · ACTIONS
 * Status/project filter chips are real filters; the ▾ PROJECT / ▾ BRAND /
 * ▾ TYPE chips are dropdown filters bound to the live data.
 * ------------------------------------------------------------------------- */

/** Coarse status buckets the chip row exposes. */
type StatusFilter = "ALL" | "OWNED" | "WISHLIST" | "BUILT" | "PRIMED";

/** Map a fine ProjectStatus onto its coarse filter bucket. */
function statusBucket(s: ProjectStatus): Exclude<StatusFilter, "ALL"> | "OTHER" {
  if (s === "WISHLIST") return "WISHLIST";
  if (s === "BUILDING") return "BUILT";
  if (s === "PRIMING") return "PRIMED";
  // OWNED + the later lifecycle stages all read as "owned/acquired".
  if (s === "SHELVED") return "OTHER";
  return "OWNED";
}

/** Tinted filter chip — active = filled accent tint, rest = outline + dim. */
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        // ≥44px tap target on touch widths, compact on desktop (UX-011).
        "inline-flex min-h-[44px] shrink-0 items-center rounded-[6px] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors md:min-h-0",
        active
          ? "bg-cyan/20 text-cyan-lite"
          : "border border-border text-fg-dim hover:border-cyan/40 hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

/** Frame's accent-tinted status pill (read-only look) for the STATUS column,
 *  wrapping the interactive StatusDropdown so the painter can still change it. */
function ProjectChip({ name, accent }: { name: string; accent: "neutral" }) {
  const tint: Record<typeof accent, string> = {
    neutral: "bg-fg/5 border-border text-fg",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap",
        tint[accent],
      )}
    >
      {name}
    </span>
  );
}

/** Per-row swatch dot (SW column). Uses the attached recipe's first swatch
 *  when present, else a neutral outlined ring (CollectionItem carries no hex). */
function SwatchDot({ hex }: { hex?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 rounded-full",
        hex ? "border border-black/40" : "border border-border",
      )}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

export function CollectionTable({
  kind,
  items,
  projects,
  onStatusChange,
  onAssignProject,
  onAttachRecipe,
  onRemove,
  onEdit,
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
  /** Optional rename/edit affordance (the ACTIONS pen). */
  onEdit?: (item: CollectionItem) => void;
  onAdd: () => void;
  recipeSwatches?: (recipeId: string) => string[];
}) {
  const isPaint = kind === "paint";
  const label = isPaint ? "paint" : "model";
  const title = isPaint ? "PAINTS" : "MODELS";
  const sectionAccent = isPaint ? "cyan" : "neutral";

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [projectFilter, setProjectFilter] = useState("");
  /** Paint = BRAND (company) filter; Model = TYPE (paintType/army-class) filter. */
  const [facetFilter, setFacetFilter] = useState("");

  // Resolve a project id → { name, accent } for the PROJECT chip. Project type
  // no longer carries a hue (colour contract §6) → every chip renders neutral.
  const projectInfo = useMemo(() => {
    const m = new Map<string, { name: string; accent: "neutral" }>();
    for (const p of projects) {
      m.set(p.id, { name: p.title, accent: "neutral" });
    }
    return m;
  }, [projects]);

  // Distinct facet values for the ▾ BRAND / ▾ TYPE dropdown.
  const facetValues = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      const v = isPaint ? i.company : (i.paintType ?? i.army ?? "");
      if (v) set.add(v);
    }
    return [...set].sort();
  }, [items, isPaint]);

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (status !== "ALL" && statusBucket(i.status) !== status) return false;
      if (projectFilter && i.projectId !== projectFilter) return false;
      if (facetFilter) {
        const v = isPaint ? i.company : (i.paintType ?? i.army ?? "");
        if (v !== facetFilter) return false;
      }
      return true;
    });
  }, [items, status, projectFilter, facetFilter, isPaint]);

  // Active projects only — a row can't be assigned to a finished/shelved project.
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "COMPLETE" && p.status !== "SHELVED"),
    [projects],
  );

  // Status chips: paints get OWNED/WISHLIST; models also get BUILT/PRIMED (24:289).
  const statusChips: StatusFilter[] = isPaint
    ? ["ALL", "OWNED", "WISHLIST"]
    : ["ALL", "OWNED", "WISHLIST", "BUILT", "PRIMED"];

  const projectOptions = [
    { value: "", label: "▾ PROJECT" },
    ...projects.map((p) => ({ value: p.id, label: p.title })),
  ];
  const facetOptions = [
    { value: "", label: isPaint ? "▾ BRAND" : "▾ TYPE" },
    ...facetValues.map((v) => ({ value: v, label: v })),
  ];

  // Column header labels (24:84 / 24:307).
  const headers = isPaint
    ? ["", "SW", "NAME", "BRAND", "TYPE", "QTY", "PRICE", "PROJECT", "STATUS", "ACTIONS"]
    : ["", "NAME", "TYPE", "QTY", "PRICE", "PROJECT", "STATUS", "TIME SPENT", "ACTIONS"];

  return (
    <div className="flex flex-col gap-6">
      {/* section-header (24:63) — accent tick · title · count · filter chips · add.
          Wraps on narrow widths so the chip row + add button never clip off the
          right edge (UX-002). */}
      {/* On a phone this header used to spend four stacked rows (title / three
          status chips / two filter dropdowns / + PAINT) before the first row of
          data. It's now two: title + add on one line, then the filters as a
          single horizontally-scrollable strip. */}
      <div className="flex flex-wrap items-center justify-between gap-2 md:h-11 md:flex-nowrap md:gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn("h-8 w-1 shrink-0 rounded-[2px]", isPaint ? "bg-cyan" : "bg-fg-muted")}
            aria-hidden
          />
          {/* h2 keeps the /collection outline h1 → h2 with no skipped level.
              The count badge sits OUTSIDE the <h2> so the heading reads
              "PAINTS"/"MODELS", not "PAINTS0" (UX-008). */}
          <div className="flex items-center gap-3">
            <h2 className={cn("font-display text-[18px] font-bold", accentText[sectionAccent])}>
              {title}
            </h2>
            <span
              aria-label={`${items.length} ${label}${items.length === 1 ? "" : "s"}`}
              className={cn(
                "rounded-[4px] px-2 py-0.5 font-mono text-[13px] font-bold",
                isPaint ? "bg-cyan/10 text-cyan-lite" : "bg-fg/5 text-fg",
              )}
            >
              {items.length}
            </span>
          </div>
        </div>

        {/* + PAINT / + MODEL — neutral outline add button. Green is reserved for
            COMPLETE / success, not add affordances (UX-004). `order` puts it
            beside the title on phones and back at the row's end on desktop. */}
        <button
          type="button"
          onClick={onAdd}
          className="order-1 shrink-0 rounded-[6px] border border-border bg-transparent px-4 py-2 font-display text-[12px] font-bold text-fg transition-colors hover:border-fg/25 hover:bg-fg/5 md:order-3"
        >
          + {isPaint ? "PAINT" : "MODEL"}
        </button>

        <div className="order-2 -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto px-3 md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:px-0">
          {statusChips.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={status === s}
              onClick={() => setStatus(s)}
            />
          ))}
          <Listbox
            value={projectFilter}
            ariaLabel={`Filter ${label} by project`}
            accent="dim"
            placeholder="▾ PROJECT"
            options={projectOptions}
            onChange={setProjectFilter}
            className="shrink-0"
            triggerClassName="!border-solid !border-border text-[11px] uppercase"
          />
          <Listbox
            value={facetFilter}
            ariaLabel={isPaint ? `Filter paint by brand` : `Filter model by type`}
            accent="dim"
            placeholder={isPaint ? "▾ BRAND" : "▾ TYPE"}
            options={facetOptions}
            onChange={setFacetFilter}
            className="shrink-0"
            triggerClassName="!border-solid !border-border text-[11px] uppercase"
          />
        </div>
      </div>

      {/* Phone table (Ross, 2026-07-27). Each entry was a four-line card; it's
          now ONE table row like desktop, carrying only what a painter actually
          scans for: NAME · STATUS · COST · edit/delete.
          Dropped on purpose — QTY (own two? add two rows), BRAND/TYPE, PROJECT
          and the "+ ATTACH" dropdown (paints reach projects through recipes,
          nothing else). All of it still renders in the ≥md table below, and the
          underlying row is identical either way, so a phone edit loses nothing. */}
      <div className="md:hidden">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-2 text-left font-mono text-[10px] font-bold uppercase tracking-wide text-fg-dim">
                Name
              </th>
              <th scope="col" className="w-[86px] px-1 text-left font-mono text-[10px] font-bold uppercase tracking-wide text-fg-dim">
                Status
              </th>
              <th scope="col" className="w-[52px] px-1 text-right font-mono text-[10px] font-bold uppercase tracking-wide text-fg-dim">
                Cost
              </th>
              <th scope="col" className="w-[56px] pl-1 text-right font-mono text-[10px] font-bold uppercase tracking-wide text-fg-dim">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-8 text-center font-mono text-body text-fg-dim">
                  {items.length === 0
                    ? `No ${label}s yet — paste a store URL above or add one by hand.`
                    : "No matches for these filters."}
                </td>
              </tr>
            ) : (
              visible.map((item, rowIndex) => {
                const firstSwatch = item.recipeId
                  ? recipeSwatches?.(item.recipeId)?.[0]
                  : undefined;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-border",
                      rowIndex % 2 === 1 && "bg-fg/[0.015]",
                    )}
                  >
                    <td className="py-1.5 pr-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {isPaint && <SwatchDot hex={firstSwatch} />}
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 truncate font-mono text-[12px] text-fg hover:text-cyan-lite hover:underline"
                          >
                            {item.name}
                          </a>
                        ) : (
                          <span className="min-w-0 truncate font-mono text-[12px] text-fg">
                            {item.name}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-1">
                      <StatusDropdown
                        kind={kind}
                        value={item.status}
                        size="xs"
                        ariaLabel={`Status for ${item.name}`}
                        onChange={(s) => onStatusChange(item, s)}
                      />
                    </td>
                    <td className="px-1 text-right font-mono text-[12px] tabular-nums text-fg-dim">
                      {item.price || "—"}
                    </td>
                    <td className="pl-1">
                      <span className="flex items-center justify-end">
                        {onEdit && (
                          <button
                            type="button"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => onEdit(item)}
                            className="inline-flex h-11 w-7 items-center justify-center text-fg-dim transition-colors hover:text-cyan-lite"
                          >
                            <PenLine size={14} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => onRemove(item)}
                          className="inline-flex h-11 w-7 items-center justify-center text-fg-dim transition-colors hover:text-red"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
            <tr>
              <td colSpan={4} className="pt-2">
                <button
                  type="button"
                  onClick={onAdd}
                  className="flex h-11 w-full items-center justify-center rounded-[8px] border border-dashed border-border px-4 font-mono text-[12px] text-fg-dim transition-colors hover:border-cyan/40 hover:text-fg"
                >
                  + Add {label} row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* table (24:83 / 24:306) — desktop only; phones use the card list above. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, i) => (
                <th
                  key={h || `c${i}`}
                  scope="col"
                  className="px-2 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-wide text-fg-dim"
                >
                  {h === "" ? (
                    <span
                      aria-hidden
                      className="inline-block h-3.5 w-3.5 rounded-[3px] border-[1.5px] border-fg-dim"
                    />
                  ) : h === "SW" ? (
                    // UX-013: "SW" is the recipe swatch column. Expand it via a
                    // tooltip + an accessible name so it isn't an unexplained
                    // two-letter abbreviation.
                    <abbr
                      title="Swatch — the attached recipe's first colour"
                      aria-label="Swatch"
                      className="cursor-help no-underline"
                    >
                      SW
                    </abbr>
                  ) : (
                    h
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-2 py-8 text-center font-mono text-body text-fg-dim">
                  {items.length === 0
                    ? `No ${label}s yet — paste a store URL above or add one by hand.`
                    : "No matches for these filters."}
                </td>
              </tr>
            ) : (
              visible.map((item, rowIndex) => {
                const proj = item.projectId ? projectInfo.get(item.projectId) : undefined;
                const firstSwatch = item.recipeId
                  ? recipeSwatches?.(item.recipeId)?.[0]
                  : undefined;
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "h-[52px] border-b border-border transition-colors hover:bg-cyan/5",
                      // Subtle zebra — alternating near-black rows (24:105/24:124).
                      rowIndex % 2 === 1 && "bg-fg/[0.015]",
                    )}
                  >
                    {/* row checkbox (decorative — bulk-select not yet wired). */}
                    <td className="px-2">
                      <span
                        aria-hidden
                        className="inline-block h-3.5 w-3.5 rounded-[3px] border border-border"
                      />
                    </td>
                    {isPaint && (
                      <td className="px-2">
                        <SwatchDot hex={firstSwatch} />
                      </td>
                    )}
                    <td className="px-2">
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[13px] text-fg hover:text-cyan-lite hover:underline"
                        >
                          {item.name}
                        </a>
                      ) : (
                        <span className="font-mono text-[13px] text-fg">{item.name}</span>
                      )}
                    </td>
                    {isPaint ? (
                      <td className="px-2 font-mono text-[12px] text-fg-dim">{item.company || "—"}</td>
                    ) : null}
                    {/* TYPE — paint: paintType; model: paintType (model class) */}
                    <td className="px-2 font-mono text-[12px] text-fg-faint">
                      {isPaint ? (item.paintType ?? "—") : (item.paintType ?? item.army ?? "—")}
                    </td>
                    <td className="px-2 font-mono text-[13px] tabular-nums text-fg">
                      {item.quantity ?? 1}
                    </td>
                    <td className="px-2 font-mono text-[13px] tabular-nums text-fg-dim">
                      {item.price || "—"}
                    </td>
                    <td className="px-2">
                      {proj ? (
                        <ProjectChip name={proj.name} accent={proj.accent} />
                      ) : (
                        <Listbox
                          value={item.projectId ?? ""}
                          ariaLabel={`Assign ${item.name} to a project`}
                          accent="neutral"
                          placeholder="+ ATTACH"
                          onChange={(v) => onAssignProject(item, v)}
                          options={[
                            { value: "", label: "+ ATTACH" },
                            ...activeProjects.map((p) => ({ value: p.id, label: p.title })),
                          ]}
                          triggerClassName="max-w-[160px]"
                        />
                      )}
                    </td>
                    <td className="px-2">
                      <StatusDropdown
                        kind={kind}
                        value={item.status}
                        ariaLabel={`Status for ${item.name}`}
                        onChange={(s) => onStatusChange(item, s)}
                      />
                    </td>
                    {/* TIME SPENT (models only) — CollectionItem carries no logged
                        time, so a dash placeholder keeps the column honest. */}
                    {!isPaint && (
                      <td className="px-2 font-mono text-[12px] text-fg-faint">—</td>
                    )}
                    <td className="px-2">
                      <span className="inline-flex items-center gap-3">
                        {onEdit && (
                          <button
                            type="button"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => onEdit(item)}
                            className="text-fg-dim transition-colors hover:text-cyan-lite"
                          >
                            <PenLine size={14} aria-hidden />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${item.name}`}
                          onClick={() => onRemove(item)}
                          className="text-fg-dim transition-colors hover:text-red"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
            {/* ghost-row (24:276) — dashed + Add <kind> row */}
            <tr>
              <td colSpan={headers.length} className="pt-2">
                <button
                  type="button"
                  onClick={onAdd}
                  className="flex h-12 w-full items-center rounded-[8px] border border-dashed border-border px-4 font-mono text-[12px] text-fg-dim transition-colors hover:border-cyan/40 hover:text-fg"
                >
                  + Add {label} row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* showing/sort footer (24:278) */}
      <div className="flex justify-end font-mono text-[11px] text-fg-dim">
        SHOWING {visible.length} OF {items.length} · SORT BY: {isPaint ? "NAME" : "STATUS"} ▾
      </div>
    </div>
  );
}
