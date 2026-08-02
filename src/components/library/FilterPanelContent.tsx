"use client";

import { Button, HexField, SearchField } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { LibraryFilter } from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-green/20 px-2 py-0.5 label-osd text-green">
      {children}
    </span>
  );
}

/**
 * One column of options (audit B5). The panel is `max-w-4xl` — 896px, ~62% of
 * a 1440px screen — and every option used to be its own full-width row with
 * the label left and the checkbox pinned to the far right: 820px of measured
 * dead space between the two on a COLOR row, and 38 companies stacked one per
 * row so the list overflowed and cut off mid-entry at HUMBROL. Columns spend
 * that width on options instead of on gap.
 */
function CheckGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    // Checkbox first, adjacent to its label: in a column the box has to sit
    // beside the thing it controls, not at some far edge.
    <label className="flex cursor-pointer items-center gap-2 py-1 font-body text-body text-fg hover:text-fg">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center border",
          checked ? "border-cyan bg-cyan/20 text-cyan-lite" : "border-fg-faint",
        )}
      >
        {checked && "✓"}
      </button>
      <span className="min-w-0 uppercase tracking-[0.1em]">{label}</span>
    </label>
  );
}

/** Filter slide-out body. Presentational — emits the whole LibraryFilter via onChange. */
export function FilterPanelContent({
  value,
  colorOptions,
  brandOptions,
  typeOptions,
  onChange,
  onClear,
}: {
  value: LibraryFilter;
  colorOptions: string[];
  brandOptions: string[];
  typeOptions: string[];
  onChange: (next: LibraryFilter) => void;
  onClear: () => void;
}) {
  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <SearchField
          name="filter-search"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
        <HexField
          name="filter-hex"
          label="Hex"
          value={value.hex ?? ""}
          onChange={(e) => onChange({ ...value, hex: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>Color</SectionLabel>
        <CheckGrid>
          {colorOptions.map((c) => (
            <CheckRow
              key={c}
              label={c}
              checked={value.colors.includes(c)}
              onToggle={() => onChange({ ...value, colors: toggle(value.colors, c) })}
            />
          ))}
        </CheckGrid>
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>Company</SectionLabel>
        <CheckGrid>
          {brandOptions.map((b) => (
            <CheckRow
              key={b}
              label={b}
              checked={value.brands.includes(b)}
              onToggle={() => onChange({ ...value, brands: toggle(value.brands, b) })}
            />
          ))}
        </CheckGrid>
      </div>

      {typeOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <SectionLabel>Type</SectionLabel>
          {/* The inner max-h-48 scroller is gone: a nested scroll area inside a
              panel that already scrolls hid options behind a second, unlabelled
              overflow. In columns the whole set fits. */}
          <CheckGrid>
            {typeOptions.map((t) => (
              <CheckRow
                key={t}
                label={t}
                checked={value.types.includes(t)}
                onToggle={() => onChange({ ...value, types: toggle(value.types, t) })}
              />
            ))}
          </CheckGrid>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <SectionLabel>Status</SectionLabel>
        <CheckGrid>
          {(["wishlist", "owned"] as const).map((s) => (
            <CheckRow
              key={s}
              label={s}
              checked={value.status.includes(s)}
              onToggle={() =>
                onChange({
                  ...value,
                  status: (value.status.includes(s)
                    ? value.status.filter((x) => x !== s)
                    : [...value.status, s]) as LibraryFilter["status"],
                })
              }
            />
          ))}
        </CheckGrid>
      </div>

      <Button variant="danger" onClick={onClear} className="mt-2">
        Clear Filter
      </Button>
    </div>
  );
}
