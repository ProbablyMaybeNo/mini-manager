"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { accentBg, accentText, eventKindAccent, type Accent } from "@/lib/palette";
import type { CalendarEvent } from "@/lib/types";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Pad a day number to the `YYYY-MM-DD` string the add-event form expects. */
function isoDay(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Compact month grid that fits its panel without scrolling. Deterministic: the month is
 * passed in (no Date.now) so SSR and client agree. Days with events get a coloured dot.
 *
 * D1/D2 additions:
 *  - `onDayClick(iso)` lets the host open the +Date form prefilled with the
 *    clicked day (MM-47).
 *  - Days with events render a hover tooltip listing the event name + kind
 *    (+ notes), so the dots are explorable without opening a panel.
 */
export function MiniCalendar({
  year = 2026,
  month = 8, // 0-indexed → September (the MAGGOTKIN tournament)
  events = [],
  onDayClick,
  showMonthLabel = true,
  className,
}: {
  year?: number;
  month?: number;
  events?: CalendarEvent[];
  onDayClick?: (iso: string) => void;
  /** When the host renders the month label itself (e.g. between nav arrows,
   *  yO830AqQH3Hu) set this false to drop the duplicate internal heading. */
  showMonthLabel?: boolean;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  // Group this month's events by day-of-month so a day can show its first
  // event's colour (dot/number) and a tooltip listing *all* of them.
  const dayEvents = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month) {
      const day = d.getUTCDate();
      const list = dayEvents.get(day) ?? [];
      list.push(e);
      dayEvents.set(day, list);
    }
  }

  function accentFor(day: number): Accent | undefined {
    const list = dayEvents.get(day);
    return list && list[0] ? eventKindAccent[list[0].kind] : undefined;
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className={cn("select-none", className)}>
      {showMonthLabel && (
        <div className="mb-1 text-center font-osd text-[12px] uppercase tracking-[0.2em] text-cyan">
          {monthLabel}
        </div>
      )}
      <div className="grid grid-cols-7 gap-px">
        {DOW.map((d, i) => (
          <div key={i} className="text-center font-osd text-[12px] text-fg-faint">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const accent = day != null ? accentFor(day) : undefined;
          const list = day != null ? dayEvents.get(day) : undefined;
          const interactive = day != null && !!onDayClick;
          const tooltip =
            list && hovered === day ? (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-40 -translate-x-1/2 border border-cyan/50 bg-bg/95 p-2 text-left shadow-lg"
              >
                {list.map((e) => (
                  <div key={e.id} className="mb-1 last:mb-0">
                    <div className="flex items-center gap-1">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", accentBg[eventKindAccent[e.kind]])}
                      />
                      <span className="truncate font-mono text-[12px] text-fg">{e.name}</span>
                    </div>
                    <div
                      className={cn(
                        "font-osd text-[12px] uppercase tracking-[0.15em]",
                        accentText[eventKindAccent[e.kind]],
                      )}
                    >
                      {e.kind}
                    </div>
                    {e.notes && (
                      <div className="mt-0.5 line-clamp-2 font-mono text-[12px] text-fg-dim">
                        {e.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null;

          const content = (
            <>
              {day}
              {accent && (
                <span
                  className={cn(
                    "absolute bottom-0.5 h-1 w-1 rounded-full",
                    accentBg[accent],
                  )}
                />
              )}
              {tooltip}
            </>
          );

          const base = cn(
            "relative flex aspect-square items-center justify-center font-mono text-[12px] tabular-nums",
            day == null && "opacity-0",
            accent ? cn(accentText[accent], "text-glow-cyan") : "text-fg-dim",
          );

          if (interactive) {
            return (
              <button
                key={i}
                type="button"
                aria-label={`${monthLabel} ${day}${list ? ` — ${list.length} event${list.length > 1 ? "s" : ""}` : ""}`}
                onClick={() => onDayClick!(isoDay(year, month, day!))}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered((h) => (h === day ? null : h))}
                onFocus={() => setHovered(day)}
                onBlur={() => setHovered((h) => (h === day ? null : h))}
                className={cn(base, "cursor-pointer rounded-sm hover:bg-cyan/10 focus:outline-none focus-visible:bg-cyan/15")}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={i}
              className={base}
              onMouseEnter={() => day != null && setHovered(day)}
              onMouseLeave={() => setHovered((h) => (h === day ? null : h))}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
