"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, MiniCalendar } from "@/components/kit";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) {
      setError("Name and date are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createEvent({ name: name.trim(), date, kind, notes: null });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName("");
    setDate("");
    setKind("tournament");
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
          className="px-2 font-mono text-sm text-fg-faint hover:text-cyan"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="px-2 font-mono text-sm text-fg-faint hover:text-cyan"
        >
          ›
        </button>
      </div>

      <MiniCalendar year={view.year} month={view.month} events={events} />

      {adding ? (
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-cyan/20 pt-2">
          <Input
            label="Event"
            name="event-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MAGGOTKIN 2k"
          />
          <Input
            label="Date"
            name="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <label className="flex flex-col gap-1">
            <span className="font-osd text-[10px] uppercase tracking-[0.15em] text-fg-faint">
              Kind
            </span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CalendarEventKind)}
              aria-label="Event kind"
              className="border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg focus:border-cyan focus:outline-none"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <span className={cn("font-osd text-[9px] uppercase tracking-[0.15em]", accentText[eventKindAccent[kind]])}>
            ▪ {kind}
          </span>
          {error && <p className="font-mono text-[11px] text-red">▸ {error}</p>}
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
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
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
