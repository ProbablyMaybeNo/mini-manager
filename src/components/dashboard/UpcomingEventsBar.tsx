import { cn } from "@/lib/cn";
import { accentText, eventKindAccent } from "@/lib/palette";
import type { CalendarEvent } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

/** Full-width bar pinned to the bottom of the dashboard. Host supplies event
 *  order. Each entry shows a colour-coded kind badge and reveals its notes in
 *  a hover tooltip (D1). */
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
          {events.map((e) => {
            const tip = e.notes
              ? `${e.name} (${e.kind}) — ${e.notes}`
              : `${e.name} (${e.kind})`;
            return (
              <li
                key={e.id}
                title={tip}
                className="group relative flex shrink-0 items-center gap-3 font-mono text-xs"
              >
                <span
                  className={cn(
                    "font-osd uppercase tracking-[0.15em]",
                    accentText[eventKindAccent[e.kind]],
                  )}
                >
                  {e.kind}
                </span>
                <span className="text-fg">{e.name}</span>
                <span className="text-fg-faint">{formatDate(e.date)}</span>
                {e.notes && (
                  <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 hidden w-56 border border-cyan/50 bg-bg/95 p-2 font-mono text-[10px] text-fg-dim shadow-lg group-hover:block">
                    {e.notes}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
