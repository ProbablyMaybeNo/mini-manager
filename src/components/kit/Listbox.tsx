"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { accentBorder, accentText, type Accent } from "@/lib/palette";

export interface ListboxOption<T extends string> {
  value: T;
  label: string;
  /** Disabled options are skipped by keyboard nav and can't be selected. */
  disabled?: boolean;
}

/**
 * Themed dropdown / listbox primitive (UX-007). A styled "pill" trigger plus a
 * phosphor-styled options panel, keyboard-accessible (Arrow / Home / End /
 * Enter / Space / Escape, plus open-on-typeahead-free Arrow), with the app's
 * visible focus ring. Replaces native <select> on the project / status
 * dropdowns so the OS popup chrome no longer breaks the terminal aesthetic.
 *
 * Controlled: the host owns `value` and is notified via `onChange`. The accent
 * tints the trigger border + text and the active option, matching the per-row
 * status/colour treatment the native selects carried.
 */
export function Listbox<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select…",
  accent = "cyan",
  disabled = false,
  size = "sm",
  triggerClassName,
  className,
}: {
  value: T | "";
  options: ListboxOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  accent?: Accent;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Extra classes on the trigger button (e.g. max-width). */
  triggerClassName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Close on outside click / focus leaving the widget.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // When opening, seed the active option to the current selection.
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabled(options));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function firstEnabled(opts: ListboxOption<T>[]): number {
    return opts.findIndex((o) => !o.disabled);
  }

  function step(dir: 1 | -1) {
    setActiveIndex((cur) => {
      let next = cur;
      for (let i = 0; i < options.length; i++) {
        next = (next + dir + options.length) % options.length;
        if (!options[next]?.disabled) return next;
      }
      return cur;
    });
  }

  function choose(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) setOpen(true);
        else if (e.key === "Enter" || e.key === " ") choose(activeIndex);
        else step(e.key === "ArrowDown" ? 1 : -1);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(firstEnabled(options));
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          for (let i = options.length - 1; i >= 0; i--) {
            if (!options[i]?.disabled) {
              setActiveIndex(i);
              break;
            }
          }
        }
        break;
    }
  }

  // Trigger = Buttons category; size only changes padding.
  const pad = size === "md" ? "px-3 py-1.5 text-button" : "px-2 py-1 text-button";

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          // Distinct "+Attach" dropdown treatment (8GfWoKTUukde): a thinner
          // pixel face (font-osd) + a DOTTED border, so a dropdown always reads
          // differently from a solid-bordered DePixel-Klein button app-wide.
          "inline-flex w-full items-center justify-between gap-2 border border-dotted bg-bg font-button tracking-[0.08em] transition-[border-color,box-shadow] duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
          pad,
          accentBorder[accent],
          "border-opacity-60",
          selected ? accentText[accent] : "text-fg-faint",
          triggerClassName,
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span aria-hidden className={cn("shrink-0 transition-transform", open && "rotate-180")}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          tabIndex={-1}
          className={cn(
            "absolute left-0 top-full z-30 mt-1 max-h-60 min-w-full overflow-y-auto border border-dotted bg-bg py-1 panel-depth",
            accentBorder[accent],
          )}
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${listId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onPointerEnter={() => !opt.disabled && setActiveIndex(i)}
                onClick={() => choose(i)}
                className={cn(
                  "cursor-pointer px-2 py-1 font-body text-body tracking-[0.08em] transition-colors",
                  opt.disabled && "cursor-not-allowed text-fg-faint/60",
                  !opt.disabled && isActive && "bg-cyan/10",
                  !opt.disabled && isSelected ? accentText[accent] : !opt.disabled && "text-fg",
                )}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
