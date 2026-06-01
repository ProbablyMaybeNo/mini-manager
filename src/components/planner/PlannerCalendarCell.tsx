import { Card } from "@/components/ui/Card";

/**
 * P14.2 — Calendar cell placeholder.
 *
 * Scaffold-only. The full month-grid widget lands in P14.3
 * (calendar widget — events with coloured dots per kind, inline
 * add-event form, click-day-to-see-events drawer). For now the
 * cell renders the friendly empty-state copy Ross signed off on.
 *
 * The cell sits in the left column of the PLANNER grid on `md+`
 * and stacks above the right column on mobile. Wrapped in its own
 * component so the P14.3 builder can replace the body without
 * touching `src/app/projects/page.tsx`.
 */
export function PlannerCalendarCell() {
  return (
    <Card title="CALENDAR" titleAs="h3" accentColor="amber">
      <div className="frame p-4 min-h-[180px] flex items-center justify-center">
        <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed text-center max-w-sm">
          Your painting calendar — tournaments, deadlines, battles.
          Add an event to start.
        </p>
      </div>
    </Card>
  );
}
