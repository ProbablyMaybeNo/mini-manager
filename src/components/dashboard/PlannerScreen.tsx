"use client";

import { useRef } from "react";
import { ActivityFeed, Panel } from "@/components/kit";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { ActivityEntry, CalendarEvent } from "@/lib/types";
import { PlannerCalendar } from "./PlannerCalendar";

/**
 * The mobile full-screen PLANNER (RF-11). The mobile dashboard shows only the
 * project cards + an "Upcoming Events" bar; tapping that bar opens this — the
 * PLANNER calendar (with "+ Date" add-event) over the ACTIVITY TRACKER — as a
 * full-screen takeover with a top-left back chevron, mirroring the RF-10
 * project surface. Desktop keeps the RightRail inline, so this is mobile-only.
 */
export function PlannerScreen({
  open,
  onClose,
  events,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  activity: ActivityEntry[];
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, onClose);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Planner"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-bg outline-none"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-cyan/40 px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-cyan-lite hover:bg-cyan/10 focus:outline-none focus-visible:bg-cyan/15"
        >
          <span aria-hidden className="text-h2">‹</span>
        </button>
        <div className="min-w-0">
          <div className="label-osd tracking-[0.2em] text-fg">DASHBOARD ▸</div>
          <h2 className="truncate label-osd-h2 text-cyan-lite">PLANNER</h2>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Panel label="PLANNER" className="p-3">
          <PlannerCalendar events={events} />
        </Panel>
        <Panel label="ACTIVITY TRACKER" className="p-3">
          <div className="max-h-[40dvh] overflow-y-auto pr-1 pt-1">
            <ActivityFeed entries={activity} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
