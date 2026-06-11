import type { EventKind } from "@/db/schema";
import type { CalendarEvent } from "@/lib/types";

/** Local Y-M-D (the calendar treats the stored ms as a day-local date). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toCalendarEvent(e: {
  id: string;
  name: string;
  eventDate: Date;
  kind: EventKind;
}): CalendarEvent {
  return { id: e.id, date: toISODate(e.eventDate), name: e.name, kind: e.kind };
}
