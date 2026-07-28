"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MiniCalendar } from "./MiniCalendar";

/** Parse a `YYYY-MM-DD` string into UTC parts; null on empty/invalid. */
function parseIso(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

/** Locale-neutral display: "16 Jun 2026" (avoids the native US mm/dd/yyyy). */
function formatDisplay(value: string): string | null {
  const p = parseIso(value);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month, p.day)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Themed date control (UX-012). A styled pill trigger showing the date in a
 * locale-neutral "DD Mon YYYY" format, opening a month-grid popover (built on
 * MiniCalendar) with prev/next navigation — no native US-format date chrome,
 * consistent with the Listbox primitive. Value/onChange use `YYYY-MM-DD`
 * (empty string clears).
 */
export function DateField({
  value,
  onChange,
  ariaLabel,
  placeholder = "Pick a date…",
  disabled = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Month the grid is showing — seeded from the value (or today) when opened.
  const seed = parseIso(value) ?? toToday();
  const [view, setView] = useState<{ year: number; month: number }>({
    year: seed.year,
    month: seed.month,
  });

  function toToday() {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth(), day: now.getUTCDate() };
  }

  useEffect(() => {
    if (open) {
      const s = parseIso(value) ?? toToday();
      setView({ year: s.year, month: s.month });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function stepMonth(dir: 1 | -1) {
    setView((v) => {
      const m = v.month + dir;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });
  }

  const display = formatDisplay(value);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className={cn(
          // 44px on touch (MUX3-010) — it was 28px, the shortest control on the
          // project form, sitting directly under three 44px siblings. Collapses
          // to the dense height at md so desktop density is untouched.
          "inline-flex min-h-11 w-full items-center justify-between gap-2 border border-cyan/60 bg-bg px-2 py-1 font-button text-button transition-[border-color,box-shadow] duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0",
          display ? "text-fg" : "text-fg-faint",
        )}
      >
        <span className="truncate">{display ?? placeholder}</span>
        <span aria-hidden className="shrink-0">
          ▦
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-30 mt-1 w-56 border border-cyan/60 bg-bg p-2 panel-depth"
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => stepMonth(-1)}
              className="flex h-6 w-6 items-center justify-center border border-cyan/30 font-button text-button text-cyan-lite hover:bg-cyan/10 focus:outline-none focus-visible:bg-cyan/15"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => stepMonth(1)}
              className="flex h-6 w-6 items-center justify-center border border-cyan/30 font-button text-button text-cyan-lite hover:bg-cyan/10 focus:outline-none focus-visible:bg-cyan/15"
            >
              ›
            </button>
          </div>
          <MiniCalendar
            year={view.year}
            month={view.month}
            onDayClick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full border border-red/40 py-1 font-button text-button uppercase tracking-[0.15em] text-red hover:bg-red/10 focus:outline-none focus-visible:bg-red/10"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
