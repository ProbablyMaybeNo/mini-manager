"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Listbox, MiniCalendar } from "@/components/kit";
import { createEvent } from "@/lib/actions/events";
import { accentText, eventKindAccent } from "@/lib/palette";
import { cn } from "@/lib/cn";
import type { CalendarEvent, CalendarEventKind } from "@/lib/types";

const KINDS: CalendarEventKind[] = ["tournament", "deadline", "battle", "other"];

/**
 * PLANNER calendar with month navigation and an inline "+ Date" add-event
 * form. Creating an event persists via the createEvent server action, then
 * refreshes so the dashboard re-renders with the new event coloured on the
 * grid and listed in the bottom ticker.
 *
 * D1/D2 behaviour:
 *  - Clicking a day on the grid opens the add form prefilled with that day
 *    (MM-47).
 *  - The Date field has a popup mini-calendar date-picker (MM-46) in addition
 *    to the native `<input type="date">`.
 *  - The form carries a Notes field, surfaced in the calendar hover tooltip.
 */
export function PlannerCalendar({
  events,
  calendarClassName = "mx-auto w-full max-w-44",
}: {
  events: CalendarEvent[];
  /** Override the month-grid sizing. Defaults to the compact rail width
   *  (max-w-44); the standalone /planner page widens it (DOP-005a). */
  calendarClassName?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<CalendarEventKind>("tournament");
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The mini date-picker popover shows whichever month the chosen date sits
  // in (or the calendar's current view as a fallback).
  const pickerView = (() => {
    if (date) {
      const d = new Date(date);
      if (!Number.isNaN(d.getTime())) {
        return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
      }
    }
    return view;
  })();

  // Match MiniCalendar's "Jun 2026" label exactly (same locale + options).
  const monthLabel = new Date(Date.UTC(view.year, view.month, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  /** MM-47 — clicking a day on the month grid opens the form prefilled. */
  function openAddForDay(iso: string) {
    setAdding(true);
    setDate(iso);
    setError(null);
    // Focus the name field so the painter can start typing immediately.
    requestAnimationFrame(() => {
      const el = document.getElementById("event-name") as HTMLInputElement | null;
      el?.focus();
    });
  }

  function resetForm() {
    setName("");
    setDate("");
    setKind("tournament");
    setNotes("");
    setPickerOpen(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) {
      setError("Name and date are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createEvent({
      name: name.trim(),
      date,
      kind,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    resetForm();
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="inline-flex h-11 min-w-11 items-center justify-center px-2 font-button text-button text-fg hover:text-cyan"
        >
          ‹
        </button>
        {/* Month label sits between the nav arrows, not below them (yO830AqQH3Hu). */}
        <span className="label-osd whitespace-nowrap text-cyan">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="inline-flex h-11 min-w-11 items-center justify-center px-2 font-button text-button text-fg hover:text-cyan"
        >
          ›
        </button>
      </div>

      {/* Cap the grid to a small, glanceable size (r-N-8) so the calendar
          stays compact within the rail rather than stretching to fill it.
          showMonthLabel=false — the label now lives between the arrows above. */}
      <MiniCalendar
        year={view.year}
        month={view.month}
        events={events}
        onDayClick={openAddForDay}
        showMonthLabel={false}
        className={calendarClassName}
      />

      {adding ? (
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-cyan/20 pt-2">
          <Input
            label="Event"
            name="event-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MAGGOTKIN 2k"
          />
          <div className="relative flex flex-col gap-1">
            <div className="flex items-end gap-1">
              <Input
                label="Date"
                name="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                containerClassName="flex-1"
              />
              <button
                type="button"
                aria-label="Open date picker"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((o) => !o)}
                className="mb-px shrink-0 border border-cyan/50 px-2 py-1 font-button text-button text-cyan hover:bg-cyan/10"
              >
                ▦
              </button>
            </div>
            {pickerOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 border border-cyan/50 bg-bg/95 p-2 shadow-lg">
                <div className="mb-1 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="Picker previous month"
                    onClick={() =>
                      setDate((d) => {
                        const base = d ? new Date(d) : new Date(Date.UTC(view.year, view.month, 1));
                        base.setUTCMonth(base.getUTCMonth() - 1);
                        return base.toISOString().slice(0, 10);
                      })
                    }
                    className="inline-flex h-11 min-w-11 items-center justify-center px-1 font-button text-button text-fg hover:text-cyan"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Picker next month"
                    onClick={() =>
                      setDate((d) => {
                        const base = d ? new Date(d) : new Date(Date.UTC(view.year, view.month, 1));
                        base.setUTCMonth(base.getUTCMonth() + 1);
                        return base.toISOString().slice(0, 10);
                      })
                    }
                    className="inline-flex h-11 min-w-11 items-center justify-center px-1 font-button text-button text-fg hover:text-cyan"
                  >
                    ›
                  </button>
                </div>
                <MiniCalendar
                  year={pickerView.year}
                  month={pickerView.month}
                  events={events}
                  onDayClick={(iso) => {
                    setDate(iso);
                    setPickerOpen(false);
                  }}
                />
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1">
            <span className="label-osd text-fg">
              Kind
            </span>
            {/* Native <select> → kit Listbox so the +DATE kind picker inherits
                the distinct dropdown style + the bigger dropdown font
                (w5cZimrBYgGh / 8GfWoKTUukde). */}
            <Listbox<CalendarEventKind>
              value={kind}
              options={KINDS.map((k) => ({ value: k, label: k }))}
              onChange={setKind}
              ariaLabel="Event kind"
              accent={eventKindAccent[kind]}
              className="w-full"
              triggerClassName="w-full"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-osd text-fg">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              aria-label="Event notes"
              placeholder="2000pts · Grand tournament"
              className="resize-none border border-cyan/50 bg-bg px-2 py-1 font-body text-body text-fg focus:border-cyan focus:outline-none"
            />
          </label>
          <span
            className={cn(
              "label-osd",
              accentText[eventKindAccent[kind]],
            )}
          >
            ▪ {kind}
          </span>
          {error && <p className="font-body text-body text-red">▸ {error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="add"
          size="sm"
          className="w-full"
          onClick={() => setAdding(true)}
        >
          + Date
        </Button>
      )}
    </div>
  );
}
