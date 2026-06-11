import { cn } from "@/lib/cn";
import type { CalendarEvent } from "@/lib/types";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Compact month grid that fits its panel without scrolling. Deterministic: the month is
 * passed in (no Date.now) so SSR and client agree. Days with events get a cyan dot.
 */
export function MiniCalendar({
  year = 2026,
  month = 8, // 0-indexed → September (the MAGGOTKIN tournament)
  events = [],
  className,
}: {
  year?: number;
  month?: number;
  events?: CalendarEvent[];
  className?: string;
}) {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const eventDays = new Set(
    events
      .filter((e) => {
        const d = new Date(e.date);
        return d.getUTCFullYear() === year && d.getUTCMonth() === month;
      })
      .map((e) => new Date(e.date).getUTCDate()),
  );

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-1 text-center font-osd text-[10px] uppercase tracking-[0.2em] text-cyan">
        {monthLabel}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {DOW.map((d, i) => (
          <div key={i} className="text-center font-osd text-[8px] text-fg-faint">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={cn(
              "relative flex aspect-square items-center justify-center font-mono text-[9px] tabular-nums",
              day == null && "opacity-0",
              day != null && eventDays.has(day)
                ? "text-cyan text-glow-cyan"
                : "text-fg-dim",
            )}
          >
            {day}
            {day != null && eventDays.has(day) && (
              <span className="absolute bottom-0.5 h-0.5 w-0.5 bg-cyan" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
