"use client";

import { Button, HexField, SearchField } from "@/components/kit";
import { cn } from "@/lib/cn";
import type { LibraryFilter } from "@/lib/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-green/20 px-2 py-0.5 font-osd text-[12px] uppercase tracking-[0.18em] text-green">
      {children}
    </span>
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
    <label className="flex cursor-pointer items-center justify-between py-1 font-mono text-xs text-fg-dim hover:text-fg">
      <span className="uppercase tracking-[0.1em]">{label}</span>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "flex h-4 w-4 items-center justify-center border",
          checked ? "border-cyan bg-cyan/20 text-cyan" : "border-fg-faint",
        )}
      >
        {checked && "✓"}
      </button>
    </label>
  );
}

/** Filter slide-out body. Presentational — emits the whole LibraryFilter via onChange. */
export function FilterPanelContent({
  value,
  colorOptions,
  brandOptions,
  onChange,
  onClear,
}: {
  value: LibraryFilter;
  colorOptions: string[];
  brandOptions: string[];
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
        {colorOptions.map((c) => (
          <CheckRow
            key={c}
            label={c}
            checked={value.colors.includes(c)}
            onToggle={() => onChange({ ...value, colors: toggle(value.colors, c) })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>Company</SectionLabel>
        {brandOptions.map((b) => (
          <CheckRow
            key={b}
            label={b}
            checked={value.brands.includes(b)}
            onToggle={() => onChange({ ...value, brands: toggle(value.brands, b) })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>Status</SectionLabel>
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
      </div>

      <Button variant="danger" onClick={onClear} className="mt-2">
        Clear Filter
      </Button>
    </div>
  );
}
