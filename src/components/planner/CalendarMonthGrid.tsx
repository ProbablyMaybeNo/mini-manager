"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { deleteEvent, updateEvent } from "@/lib/actions/events";
import { eventKinds, type EventKind } from "@/db/schema";
import { AddEventForm } from "./AddEventForm";

/**
 * P14.3 — Calendar month grid.
 *
 * Renders a 7-column month-view grid with:
 *   - Prev / Today / Next nav buttons.
 *   - Coloured dot per event on the right day, one dot per `event.kind`:
 *       tournament = red
 *       deadline   = yellow
 *       battle     = purple
 *       other      = cyan (status dot only — Button discipline still
 *                          forbids cyan on action buttons, dots are
 *                          status indicators not actions)
 *   - Today's cell highlighted with the accent ring.
 *   - Clicking a day with events expands a per-day list below with
 *     edit + delete affordances per event.
 *   - "Add event" inline form below the grid (pre-fills date when the
 *     painter taps an empty cell).
 *
 * The grid uses the user's local timezone for the day-bucket: events
 * stored as midnight-UTC display on the day-of-month the painter
 * picked, regardless of where the painter is reading from. The day
 * key is the `YYYY-MM-DD` of the UTC date — same shape `<input
 * type="date">` emits.
 */

export interface CalendarEventView {
  id: string;
  name: string;
  /** Stored as ms-since-epoch on the server, hydrated to a Date. */
  eventDate: Date;
  kind: EventKind;
  notes: string | null;
}

interface Props {
  /** Server-rendered events for the focused month. */
  events: ReadonlyArray<CalendarEventView>;
  /** Year of the focused month (e.g. 2026). */
  year: number;
  /** 0-based month index (Jan = 0). */
  monthIndex: number;
}

const KIND_DOT_CLASS: Record<EventKind, string> = {
  tournament: "bg-[var(--color-red)]",
  deadline: "bg-[var(--color-yellow)]",
  battle: "bg-[var(--color-purple-pastel)]",
  other: "bg-[var(--color-cyan)]",
};

const KIND_LABEL: Record<EventKind, string> = {
  tournament: "Tournament",
  deadline: "Deadline",
  battle: "Battle",
  other: "Other",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `YYYY-MM-DD` key from a Date interpreted in UTC. */
function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeyFor(year: number, monthIndex: number, day: number): string {
  return utcDayKey(new Date(Date.UTC(year, monthIndex, day)));
}

/** Today's UTC day key — used to highlight today's cell. */
function todayUtcKey(): string {
  return utcDayKey(new Date());
}

export function CalendarMonthGrid({ events, year, monthIndex }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [focusedYear, setFocusedYear] = useState(year);
  const [focusedMonth, setFocusedMonth] = useState(monthIndex);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // The server hands us events for the current month; when the painter
  // navs to a different month, we ask the router for a fresh render
  // (page reads a new range). Until that resolves, we still want the
  // grid to show the next month's empty shell so the nav feels
  // instant.
  const eventsByDay = useMemo(() => {
    const out = new Map<string, CalendarEventView[]>();
    for (const ev of events) {
      const key = utcDayKey(ev.eventDate);
      const arr = out.get(key) ?? [];
      arr.push(ev);
      out.set(key, arr);
    }
    return out;
  }, [events]);

  const today = todayUtcKey();

  // Build the day cells for the focused month.
  // We pad the leading week with cells from the previous month so the
  // grid lines up under the weekday-labels row. Same for the trailing
  // edge if the month ends mid-week.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(focusedYear, focusedMonth, 1));
    const firstWeekday = firstOfMonth.getUTCDay(); // 0 = Sun
    const daysInMonth = new Date(
      Date.UTC(focusedYear, focusedMonth + 1, 0),
    ).getUTCDate();

    type Cell = { key: string; day: number; inMonth: boolean };
    const out: Cell[] = [];

    // Leading pad: previous month tail.
    const daysInPrev = new Date(
      Date.UTC(focusedYear, focusedMonth, 0),
    ).getUTCDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      const prevMonth = focusedMonth - 1;
      const prevYear = prevMonth < 0 ? focusedYear - 1 : focusedYear;
      const m = (prevMonth + 12) % 12;
      out.push({ key: dayKeyFor(prevYear, m, day), day, inMonth: false });
    }

    // Current month.
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        key: dayKeyFor(focusedYear, focusedMonth, d),
        day: d,
        inMonth: true,
      });
    }

    // Trailing pad to fill the last row to a multiple of 7.
    while (out.length % 7 !== 0) {
      const nextDay = out.length - daysInMonth - firstWeekday + 1;
      const nextMonth = focusedMonth + 1;
      const nextYear = nextMonth > 11 ? focusedYear + 1 : focusedYear;
      const m = nextMonth % 12;
      out.push({
        key: dayKeyFor(nextYear, m, nextDay),
        day: nextDay,
        inMonth: false,
      });
    }

    return out;
  }, [focusedYear, focusedMonth]);

  const navigate = (deltaMonths: number) => {
    setActionError(null);
    setExpandedDayKey(null);
    setEditingId(null);
    let nextMonth = focusedMonth + deltaMonths;
    let nextYear = focusedYear;
    while (nextMonth < 0) {
      nextMonth += 12;
      nextYear -= 1;
    }
    while (nextMonth > 11) {
      nextMonth -= 12;
      nextYear += 1;
    }
    setFocusedMonth(nextMonth);
    setFocusedYear(nextYear);
    // Tell the page to re-fetch for the new month. The page reads
    // year + month via search params (handled in the page wrapper).
    const params = new URLSearchParams();
    params.set("calYear", String(nextYear));
    params.set("calMonth", String(nextMonth));
    startTransition(() => {
      router.replace(`/projects?${params.toString()}#planner-calendar`);
    });
  };

  const onDelete = (id: string) => {
    setActionError(null);
    startTransition(async () => {
      const res = await deleteEvent({ id });
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3" id="planner-calendar">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-mono text-sm uppercase tracking-wider text-[var(--color-fg)]">
          {MONTH_NAMES[focusedMonth]} {focusedYear}
        </h4>
        <div className="inline-flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            aria-label="Previous month"
          >
            &larr; Prev
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              const y = now.getUTCFullYear();
              const m = now.getUTCMonth();
              if (y === focusedYear && m === focusedMonth) return;
              navigate(
                (y - focusedYear) * 12 + (m - focusedMonth),
              );
            }}
            aria-label="Jump to today"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(1)}
            aria-label="Next month"
          >
            Next &rarr;
          </Button>
        </div>
      </header>

      <div
        role="grid"
        aria-label={`${MONTH_NAMES[focusedMonth]} ${focusedYear} calendar`}
        // P14.8 — tighter inner padding on mobile so each day cell
        // clears the 40px tap-target floor at iPhone-mini viewports.
        className="frame p-1 sm:p-2"
      >
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-2xs font-mono uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {cells.map((cell) => {
            const dayEvents = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === today;
            const isExpanded = expandedDayKey === cell.key;
            const hasEvents = dayEvents.length > 0;
            return (
              <button
                key={cell.key}
                type="button"
                role="gridcell"
                aria-label={`${cell.key}${
                  hasEvents ? ` · ${dayEvents.length} event(s)` : ""
                }`}
                aria-current={isToday ? "date" : undefined}
                onClick={() => {
                  setActionError(null);
                  setEditingId(null);
                  if (isExpanded) {
                    setExpandedDayKey(null);
                  } else {
                    setExpandedDayKey(cell.key);
                  }
                }}
                className={clsx(
                  "frame relative min-h-[48px] sm:min-h-[60px] p-1.5 text-left",
                  "transition-colors",
                  cell.inMonth
                    ? "bg-[var(--color-bg-panel)] text-[var(--color-fg)]"
                    : "bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] opacity-60",
                  isToday &&
                    "ring-2 ring-[var(--color-accent)] ring-offset-0",
                  isExpanded &&
                    "outline outline-2 outline-[var(--color-amber)]",
                  hasEvents && "cursor-pointer",
                )}
              >
                <span className="block font-mono text-xs leading-none">
                  {cell.day}
                </span>
                {hasEvents ? (
                  <span
                    className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-0.5"
                    aria-hidden
                  >
                    {dayEvents.slice(0, 4).map((ev) => (
                      <span
                        key={ev.id}
                        title={`${KIND_LABEL[ev.kind]} — ${ev.name}`}
                        className={clsx(
                          "block w-2 h-2 rounded-full",
                          KIND_DOT_CLASS[ev.kind],
                        )}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend so the painter can read the dots without trial-and-error. */}
      <div className="flex flex-wrap items-center gap-3 text-2xs font-mono text-[var(--color-fg-muted)]">
        {eventKinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={clsx("block w-2 h-2 rounded-full", KIND_DOT_CLASS[k])}
            />
            {KIND_LABEL[k]}
          </span>
        ))}
      </div>

      {expandedDayKey ? (
        <DayExpansion
          dayKey={expandedDayKey}
          events={eventsByDay.get(expandedDayKey) ?? []}
          editingId={editingId}
          onEdit={(id) => {
            setActionError(null);
            setEditingId(id);
          }}
          onCancelEdit={() => setEditingId(null)}
          onDelete={onDelete}
          onUpdated={() => {
            setEditingId(null);
            router.refresh();
          }}
          actionError={actionError}
        />
      ) : null}

      <AddEventForm initialDate={expandedDayKey ?? ""} />
    </div>
  );
}

/* ============================================================
   Per-day expansion panel — renders below the grid when the
   painter taps a day. Lists every event on that day with an
   edit button (swaps the row to an inline edit form) and a
   delete button (confirm-then-mutate).
   ============================================================ */

interface DayExpansionProps {
  dayKey: string;
  events: ReadonlyArray<CalendarEventView>;
  editingId: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onUpdated: () => void;
  actionError: string | null;
}

function DayExpansion({
  dayKey,
  events,
  editingId,
  onEdit,
  onCancelEdit,
  onDelete,
  onUpdated,
  actionError,
}: DayExpansionProps) {
  return (
    <div
      className="frame p-3 space-y-3"
      aria-label={`Events on ${dayKey}`}
      data-day-key={dayKey}
    >
      <h5 className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
        Events on {dayKey}
      </h5>
      {events.length === 0 ? (
        <p className="text-sm font-sans text-[var(--color-fg-muted)]">
          Nothing on this day yet. Add an event below to fill it in.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) =>
            editingId === ev.id ? (
              <li key={ev.id}>
                <EditEventRow
                  event={ev}
                  onCancel={onCancelEdit}
                  onSaved={onUpdated}
                />
              </li>
            ) : (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-2 frame p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm text-[var(--color-fg)] font-semibold">
                    <span
                      aria-hidden
                      className={clsx(
                        "inline-block w-2 h-2 rounded-full mr-2 align-middle",
                        KIND_DOT_CLASS[ev.kind],
                      )}
                    />
                    {ev.name}
                  </p>
                  <p className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                    {KIND_LABEL[ev.kind]}
                  </p>
                  {ev.notes ? (
                    <p className="font-sans text-xs text-[var(--color-fg-muted)] mt-1 whitespace-pre-wrap">
                      {ev.notes}
                    </p>
                  ) : null}
                </div>
                <div className="inline-flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(ev.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(ev.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {actionError ? (
        <p role="alert" className="text-2xs font-mono text-[var(--color-red)]">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

interface EditEventRowProps {
  event: CalendarEventView;
  onCancel: () => void;
  onSaved: () => void;
}

function EditEventRow({ event, onCancel, onSaved }: EditEventRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(utcDayKey(event.eventDate));
  const [kind, setKind] = useState<EventKind>(event.kind);
  const [notes, setNotes] = useState(event.notes ?? "");

  const inputCls = clsx(
    "frame px-3 py-1.5 font-sans text-sm",
    "bg-[var(--color-bg-panel)] text-[var(--color-fg)]",
    "border border-[var(--color-border-strong)] rounded-sm",
    "focus:outline-2 focus:outline-[var(--color-accent)]",
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await updateEvent({
        id: event.id,
        name: name.trim(),
        date,
        kind,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-label={`Edit event ${event.name}`}
      className="flex flex-col gap-2 frame p-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className={inputCls}
          aria-label="Name"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputCls}
          aria-label="Date"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EventKind)}
          className={inputCls}
          aria-label="Kind"
        >
          {eventKinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Notes (optional)"
        className={inputCls}
        aria-label="Notes"
      />
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        {error ? (
          <span
            role="alert"
            className="text-2xs font-mono text-[var(--color-red)]"
          >
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
