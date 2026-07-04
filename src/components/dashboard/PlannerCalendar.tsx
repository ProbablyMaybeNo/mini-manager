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
export function PlannerCalendar({ events }: { events: CalendarEvent[] }) {
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

  // Full month name + year ("JUNE 2026") to match the 4:185 calendar header.
  const monthLabel = new Date(Date.UTC(view.year, view.month, 1))
    .toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();

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
    <div className="flex flex-col gap-4">
      {/* 4:186 header: full month name left-aligned, ‹ › nav at the right. */}
      <div className="flex items-start justify-between">
        <span className="whitespace-nowrap font-mono text-[14px] font-bold text-fg-bright">
          {monthLabel}
        </span>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="inline-flex h-11 w-11 items-center justify-center text-fg-dim hover:text-cyan-lite"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="inline-flex h-11 w-11 items-center justify-center text-fg-dim hover:text-cyan-lite"
          >
            ›
          </button>
        </div>
      </div>

      {/* Full-width month grid (4:191) — the calendar fills the rail's 222px
          content width, not a capped 170px column. showMonthLabel=false: the
          label lives in the header row above. */}
      <MiniCalendar
        year={view.year}
        month={view.month}
        events={events}
        onDayClick={openAddForDay}
        showMonthLabel={false}
        className="w-full"
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
                className="mb-px shrink-0 border border-cyan/50 px-2 py-1 font-button text-button text-cyan-lite hover:bg-cyan/10"
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
                    className="inline-flex h-11 min-w-11 items-center justify-center px-1 font-button text-button text-fg hover:text-cyan-lite"
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
                    className="inline-flex h-11 min-w-11 items-center justify-center px-1 font-button text-button text-fg hover:text-cyan-lite"
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
          {error && <p className="font-body text-body text-red-text">▸ {error}</p>}
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
        // 4:279 — full-width bordered ghost button, centred dim label.
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-8 w-full items-center justify-center rounded-[6px] border border-border font-mono text-[11px] text-fg-dim transition-colors hover:border-cyan/50 hover:text-cyan-lite focus:outline-none focus-visible:border-cyan"
        >
          + ADD DATE
        </button>
      )}
    </div>
  );
}
