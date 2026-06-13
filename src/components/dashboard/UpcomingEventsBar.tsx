import { cn } from "@/lib/cn";
import { accentText, type Accent } from "@/lib/palette";
import type { CalendarEvent, CalendarEventKind } from "@/lib/types";

const KIND_ACCENT: Record<CalendarEventKind, Accent> = {
  tournament: "cyan",
  deadline: "red",
  battle: "yellow",
  other: "purple",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

/** Full-width bar pinned to the bottom of the dashboard. Host supplies event order. */
export function UpcomingEventsBar({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto border-t border-cyan/40 bg-bg-raised/40 px-4 py-2">
      <span className="shrink-0 font-osd text-[11px] uppercase tracking-[0.18em] text-cyan">
        Upcoming events:
      </span>
      {events.length === 0 ? (
        <span className="font-mono text-xs text-fg-faint">Nothing scheduled.</span>
      ) : (
        <ul className="flex items-center gap-6">
          {events.map((e) => (
            <li key={e.id} className="flex shrink-0 items-center gap-3 font-mono text-xs">
              <span
                className={cn(
                  "font-osd uppercase tracking-[0.15em]",
                  accentText[KIND_ACCENT[e.kind]],
                )}
              >
                {e.kind}
              </span>
              <span className="text-fg">{e.name}</span>
              <span className="text-fg-faint">{formatDate(e.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
