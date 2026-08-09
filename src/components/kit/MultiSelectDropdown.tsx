"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { accentBorder, accentText, type Accent } from "@/lib/palette";
import { Checkbox } from "./Checkbox";

export interface MultiSelectOption {
  value: string;
  label?: string;
}

/**
 * Compact multi-select filter control (Colour Match mobile filter rework) —
 * a trigger button summarising the current selection ("All brands" /
 * "3 brands") that opens a dashed-border popover of checkbox rows. Sibling to
 * the single-select `Listbox`: use this one whenever a filter can have more
 * than one value checked at once instead of the old always-visible stacked
 * row-of-buttons pattern, which read as a long scroll wall on mobile.
 *
 * Controlled: the host owns `selected` and is notified via `onChange` with
 * the full next Set — same semantics as the inline toggle buttons it
 * replaces, so swapping this in never changes filtering behaviour or
 * defaults, only the affordance.
 */
export function MultiSelectDropdown({
  heading,
  options,
  selected,
  onChange,
  ariaLabel,
  allLabel,
  countLabel = (n) => `${n} selected`,
  accent = "cyan",
  footnote,
  align = "left",
  triggerClassName,
  className,
}: {
  /** Facet name shown as the popover header, e.g. "Brands" / "Type". */
  heading: string;
  options: ReadonlyArray<string | MultiSelectOption>;
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  ariaLabel: string;
  /** Trigger text when nothing is checked, e.g. "All brands" / "Default". */
  allLabel: string;
  /** Trigger text when N options are checked. Defaults to "N selected". */
  countLabel?: (n: number) => string;
  accent?: Accent;
  /** Optional helper line under the checkbox list, shown only while nothing
   *  is selected (mirrors the old inline "Default hides…" hint). */
  footnote?: string;
  /** Which trigger edge the popover is anchored to. The list is `w-max`, so a
   *  left-anchored popover on a narrow trigger sitting at the right edge of a
   *  container grows outward and gets clipped — pass "right" there and it
   *  opens inward instead. */
  align?: "left" | "right";
  triggerClassName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const count = selected.size;
  const summary = count > 0 ? countLabel(count) : allLabel;

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  return (
    <div ref={rootRef} className={cn("relative inline-block w-full min-w-0", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 border border-dotted bg-bg px-2 py-1.5 font-button text-button tracking-[0.08em] transition-[border-color,box-shadow] duration-150 focus:outline-none",
          accentBorder[accent],
          "border-opacity-60",
          count > 0 ? accentText[accent] : "text-fg-faint",
          triggerClassName,
        )}
      >
        <span className="truncate">{summary}</span>
        <span aria-hidden className={cn("shrink-0 transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          className={cn(
            "absolute top-full z-30 mt-1 max-h-72 w-max min-w-full overflow-y-auto border border-dotted bg-bg py-1 panel-depth motion-safe:animate-menu-in",
            align === "right" ? "right-0" : "left-0",
            accentBorder[accent],
          )}
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <span className="label-osd text-fg-faint">{heading}</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="font-button text-button text-red hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {normalized.map((opt) => {
            const active = selected.has(opt.value);
            return (
              <label
                key={opt.value}
                role="option"
                aria-selected={active}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-2 py-1 font-body text-body tracking-[0.02em] transition-colors hover:bg-cyan/10",
                  active ? accentText[accent] : "text-fg",
                )}
              >
                <Checkbox
                  checked={active}
                  onChange={() => toggle(opt.value)}
                  ariaLabel={opt.label ?? opt.value}
                />
                <span className="truncate">{opt.label ?? opt.value}</span>
              </label>
            );
          })}
          {footnote && count === 0 && (
            <p className="mt-1 max-w-[240px] border-t border-fg/10 px-2 pt-2 font-body text-body text-fg-faint">
              {footnote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
