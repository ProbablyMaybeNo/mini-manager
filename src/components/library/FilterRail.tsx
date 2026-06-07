"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { clsx } from "clsx";
import { PanelLeftClose, Filter } from "lucide-react";

import type { Paint, PaintFilter, PaintType } from "@/lib/paints/types";
import { paintTypes } from "@/lib/paints/types";
import { HUE_BANDS, countActiveFilters } from "@/lib/paints/filters";
import { writeFilterToParams } from "@/lib/paints/filterUrl";
import { useFilterRailCollapsed } from "@/lib/hooks/useFilterRailCollapsed";
import { TypeIcon } from "./TypeIcon";
import { Button } from "@/components/ui/Button";

/**
 * Left-rail filter set. Brand multi-select (flat scrollable checkbox
 * list — P12.21 retired the A-Z fold), line multi-select (filtered to
 * selected brands), type chips, hue band chips, owned-only toggle
 * (disabled until P2.3), hex search, free-text search.
 *
 * Filter state lives in the URL — every change pushes a router.replace
 * so back/forward and link-sharing work. The component shows local state
 * for input responsiveness, flushing to the URL on commit.
 */
export function FilterRail({
  paints,
  filter,
  className,
  disableCollapse = false,
}: {
  paints: ReadonlyArray<Paint>;
  filter: PaintFilter;
  className?: string;
  /** When true (mobile drawer), the collapse toggle is hidden and the
   *  rail always renders fully expanded — the drawer has its own close
   *  affordance. Default false (desktop rail with collapse toggle). */
  disableCollapse?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useFilterRailCollapsed();
  const isCollapsed = !disableCollapse && collapsed;

  // Derive brand and line lists from the catalog. Memoised so we don't
  // walk 7k rows on every keystroke.
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    for (const p of paints) set.add(p.brand);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [paints]);

  const linesForSelectedBrands = useMemo(() => {
    const set = new Set<string>();
    const wantBrands = new Set(filter.brands);
    for (const p of paints) {
      if (!p.line) continue;
      if (wantBrands.size && !wantBrands.has(p.brand)) continue;
      set.add(p.line);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [paints, filter.brands]);

  function commit(patch: Partial<PaintFilter>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    writeFilterToParams(params, patch);
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  // Local text state for hex + free-text inputs; debounced flush.
  const [textLocal, setTextLocal] = useState(filter.textQuery);
  const [hexLocal, setHexLocal] = useState(filter.hexQuery);
  useEffect(() => {
    setTextLocal(filter.textQuery);
  }, [filter.textQuery]);
  useEffect(() => {
    setHexLocal(filter.hexQuery);
  }, [filter.hexQuery]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (textLocal !== filter.textQuery) commit({ textQuery: textLocal });
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textLocal]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (hexLocal !== filter.hexQuery) commit({ hexQuery: hexLocal });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexLocal]);

  // P12.21 — drop the A-Z fold entirely. Ross's brief: render every
  // brand as a simple scrollable checkbox list. The FlatBrandList
  // already caps height via max-h-48 + overflow-y-auto so even with
  // 30+ brands the rail stays bounded.
  const brandCollapse = false;
  const activeFilterCount = countActiveFilters(filter);

  if (isCollapsed) {
    return (
      <aside
        className={clsx(
          "flex flex-col border-r border-[var(--color-border)] shrink-0",
          "w-[48px] transition-[width] duration-200 ease-out",
          className,
        )}
        aria-label="Library filters (collapsed)"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand filters"
          aria-expanded={false}
          title="Expand filters"
          className="relative inline-flex items-center justify-center h-12 w-full text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] transition-colors"
        >
          <Filter size={18} strokeWidth={1.75} aria-hidden />
          {activeFilterCount > 0 ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm bg-[var(--color-accent)] text-[var(--color-bg)] font-mono text-2xs leading-none"
            >
              {activeFilterCount}
            </span>
          ) : null}
          <span className="sr-only">
            {activeFilterCount > 0
              ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
              : "No active filters"}
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={clsx(
        "flex flex-col border-r border-[var(--color-border)]",
        "md:w-[240px] md:shrink-0",
        "transition-[width] duration-200 ease-out",
        "overflow-y-auto",
        className,
      )}
      aria-label="Library filters"
      data-pending={isPending ? "true" : undefined}
    >
      <header className="card-header sticky top-0 z-10 bg-[var(--color-bg-elevated)]">
        <span className="card-header-title">
          <span aria-hidden className="card-header-accent bg-[var(--color-cyan)]" />
          <span>FILTERS</span>
        </span>
        {disableCollapse ? null : (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse filters"
            aria-expanded={true}
            title="Collapse filters"
            className="inline-flex items-center justify-center h-7 w-7 rounded-sm text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] transition-colors"
          >
            <PanelLeftClose size={14} strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </header>
      <div className="flex flex-col gap-5 px-3 py-4">
      <Section title="Search">
        <input
          type="search"
          value={textLocal}
          onChange={(e) => setTextLocal(e.target.value)}
          placeholder="Name, brand, sku…"
          // UX-011 — py-2 lifts the filter input above the 24px floor with
          // breathing room (globals already floor inputs to 44px on touch).
          className="w-full px-2 py-2 frame bg-[var(--color-bg-elevated)] font-mono text-sm focus:border-[var(--color-accent)]"
          aria-label="Free-text search"
        />
      </Section>

      <Section title="Hex">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-6 w-6 rounded-sm border border-[var(--color-border)]"
            style={{ background: hexLocal && /^#?[0-9a-f]{6}$/i.test(hexLocal) ? withHash(hexLocal) : "transparent" }}
          />
          <input
            type="text"
            value={hexLocal}
            onChange={(e) => setHexLocal(e.target.value)}
            placeholder="#5a9dd8"
            maxLength={7}
            spellCheck={false}
            className="flex-1 min-w-0 px-2 py-1.5 frame bg-[var(--color-bg-elevated)] font-mono text-xs focus:border-[var(--color-accent)]"
            aria-label="Hex colour proximity"
          />
        </div>
      </Section>

      <Section title="Type">
        <div className="flex flex-wrap gap-1">
          {paintTypes.map((t) => {
            const active = filter.types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => commit({ types: toggle(filter.types, t) as PaintType[] })}
                className={chipClass(active)}
                aria-pressed={active}
              >
                <TypeIcon type={t} className={active ? "text-[var(--color-accent)]" : undefined} />
                <span className="ml-1">{t}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Hue">
        <div className="flex flex-wrap gap-1">
          {HUE_BANDS.map((band) => {
            const active = filter.hueBands.includes(band.name);
            return (
              <button
                key={band.name}
                type="button"
                onClick={() => commit({ hueBands: toggle(filter.hueBands, band.name) })}
                className={chipClass(active)}
                aria-pressed={active}
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: band.swatch }}
                />
                <span className="ml-1.5">{band.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Brand">
        {brandCollapse ? (
          <CollapsibleBrandList
            allBrands={allBrands}
            selected={filter.brands}
            onToggle={(b) => commit({ brands: toggle(filter.brands, b) })}
          />
        ) : (
          <FlatBrandList
            allBrands={allBrands}
            selected={filter.brands}
            onToggle={(b) => commit({ brands: toggle(filter.brands, b) })}
          />
        )}
      </Section>

      {linesForSelectedBrands.length > 0 ? (
        <Section title="Line">
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {linesForSelectedBrands.map((line) => {
              const active = filter.lines.includes(line);
              return (
                <label
                  key={line}
                  className={clsx(
                    // UX-011 — `tap-target` floors the clickable label row to
                    // 44px on touch / 32px desktop, both ≥ the WCAG 24px
                    // minimum (was an ~18px mis-tap target at py-0.5).
                    "tap-target flex items-center gap-2 px-1 text-xs font-mono cursor-pointer",
                    active && "text-[var(--color-accent)]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => commit({ lines: toggle(filter.lines, line) })}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="truncate">{line}</span>
                </label>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section title="Inventory">
        {/* UX-011 — tap-target floors this toggle row to ≥24px (44px touch). */}
        <label className="tap-target flex items-center gap-2 text-xs font-mono cursor-pointer">
          <input
            type="checkbox"
            checked={filter.ownedOnly}
            onChange={(e) => commit({ ownedOnly: e.target.checked })}
            className="accent-[var(--color-accent)]"
          />
          <span>Owned only</span>
        </label>
      </Section>

      {hasActiveFilter(filter) ? (
        <Button
          type="button"
          onClick={() =>
            commit({
              brands: [],
              lines: [],
              types: [],
              hueBands: [],
              hexQuery: "",
              textQuery: "",
              ownedOnly: false,
            })
          }
          variant="ghost"
          size="sm"
          className="self-start"
        >
          Clear all filters
        </Button>
      ) : null}
      </div>
    </aside>
  );
}

function chipClass(active: boolean): string {
  return clsx(
    // UX-011 — min-h-[24px] keeps the type/hue chips at/above the WCAG
    // target floor (py-1 + text-2xs alone read ~22px).
    "inline-flex items-center px-2 py-1 min-h-[24px] text-2xs font-mono rounded-sm border",
    "transition-colors",
    active
      ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]"
      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]",
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-title m-0">{title}</h2>
      {children}
    </section>
  );
}

function hasActiveFilter(f: PaintFilter): boolean {
  return countActiveFilters(f) > 0;
}

function withHash(s: string): string {
  return s.startsWith("#") ? s : `#${s}`;
}

function FlatBrandList({
  allBrands,
  selected,
  onToggle,
}: {
  allBrands: string[];
  selected: string[];
  onToggle: (b: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
      {allBrands.map((b) => (
        <BrandRow key={b} brand={b} selected={selected.includes(b)} onToggle={onToggle} />
      ))}
    </div>
  );
}

function CollapsibleBrandList({
  allBrands,
  selected,
  onToggle,
}: {
  allBrands: string[];
  selected: string[];
  onToggle: (b: string) => void;
}) {
  const groups = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const b of allBrands) {
      const letter = (b[0] ?? "#").toUpperCase();
      const list = out.get(letter) ?? [];
      list.push(b);
      out.set(letter, list);
    }
    return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [allBrands]);

  // Open any letter where a brand is currently selected.
  const initiallyOpen = useMemo(() => {
    const s = new Set<string>();
    for (const b of selected) s.add((b[0] ?? "").toUpperCase());
    return s;
  }, [selected]);
  const [open, setOpen] = useState<ReadonlySet<string>>(initiallyOpen);

  useEffect(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      for (const b of selected) next.add((b[0] ?? "").toUpperCase());
      return next;
    });
  }, [selected]);

  function toggleLetter(letter: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
      {groups.map(([letter, brands]) => {
        const isOpen = open.has(letter);
        const selectedInGroup = brands.some((b) => selected.includes(b));
        return (
          <div key={letter}>
            <button
              type="button"
              onClick={() => toggleLetter(letter)}
              className={clsx(
                "w-full flex items-center justify-between px-1 py-1 min-h-[24px] text-2xs font-mono uppercase tracking-wider",
                selectedInGroup
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              )}
              aria-expanded={isOpen}
            >
              <span>{letter}</span>
              <span aria-hidden>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen ? (
              <div className="flex flex-col pl-3">
                {brands.map((b) => (
                  <BrandRow
                    key={b}
                    brand={b}
                    selected={selected.includes(b)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BrandRow({
  brand,
  selected,
  onToggle,
}: {
  brand: string;
  selected: boolean;
  onToggle: (b: string) => void;
}) {
  return (
    <label
      className={clsx(
        // UX-011 — tap-target floors each brand row to a ≥24px hit area
        // (44px on touch); was ~18px at py-0.5.
        "tap-target flex items-center gap-2 px-1 text-xs font-mono cursor-pointer",
        selected && "text-[var(--color-accent)]",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(brand)}
        className="accent-[var(--color-accent)]"
      />
      <span className="truncate">{brand}</span>
    </label>
  );
}
