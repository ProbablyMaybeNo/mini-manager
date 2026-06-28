import { accentDot, activityAccentFor } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { ActivityEntry, CalendarEvent } from "@/lib/types";
import { PlannerCalendar } from "./PlannerCalendar";

/** Short "Jun 12" style date for the UPCOMING list, matching the 4:4 rail. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Dashboard right rail (Figma 4:184) — ONE dedicated unboxed side panel, NOT a
 * stack of bordered Panel boxes. A left hairline border separates it from the
 * content; inside, three plain labelled sections are split by thin dividers:
 *   1. the month calendar (JUNE 2026 + ‹ › + full-width + ADD DATE)
 *   2. UPCOMING — event name + short date (no dots)
 *   3. RECENT ACTIVITY — coloured dot + text + time-ago (two-line block)
 */
export function RightRail({
  events,
  activity,
}: {
  events: CalendarEvent[];
  activity: ActivityEntry[];
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <aside
      aria-label="Planner"
      className="flex w-full shrink-0 flex-col gap-8 border-l border-border bg-bg p-6 xl:w-[270px]"
    >
      {/* Calendar section (4:185): bare header + grid + ADD DATE, no box. */}
      <section>
        <PlannerCalendar events={events} />
      </section>

      <div className="h-px w-full bg-border" aria-hidden />

      {/* UPCOMING (4:282): named events + short date, today-forward. No dots. */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-fg-dim">
          UPCOMING
        </h2>
        {upcoming.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <span
                  className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-bright"
                  title={e.name}
                >
                  {e.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg-dim">
                  {shortDate(e.date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[12px] text-fg-dim">Nothing scheduled</p>
        )}
      </section>

      <div className="h-px w-full bg-border" aria-hidden />

      {/* RECENT ACTIVITY (4:298): coloured dot + two-line block (text / when). */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[12px] font-bold uppercase tracking-wide text-fg-dim">
          RECENT ACTIVITY
        </h2>
        {activity.length > 0 ? (
          <ul className="flex max-h-[min(20rem,38vh)] flex-col gap-3.5 overflow-y-auto pr-1">
            {activity.map((e) => {
              const accent = activityAccentFor(e.icon);
              return (
                <li key={e.id} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      accentDot[accent],
                    )}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-mono text-[12px] text-fg-bright" title={e.text}>
                      {e.text}
                    </span>
                    <span className="font-mono text-[10px] text-fg-dim">{e.when}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="font-mono text-[12px] text-fg-dim">
            No activity yet — your painting moves will show here.
          </p>
        )}
      </section>
    </aside>
  );
}
