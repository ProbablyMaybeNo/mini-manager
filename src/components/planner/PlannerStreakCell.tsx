import { Card } from "@/components/ui/Card";

/**
 * P14.2 — Streak counter cell placeholder.
 *
 * Scaffold-only. The full widget (P14.5) derives a consecutive-days
 * count from `activity_log` (stage_bump + recipe_created rows) and
 * renders microcopy by state. For now the cell shows a tight "0
 * days" placeholder so the layout has the same visual weight it
 * will have once the widget lands.
 */
export function PlannerStreakCell() {
  return (
    <Card title="STREAK" titleAs="h3" accentColor="purple">
      <div className="frame p-3 flex items-baseline gap-2">
        <span className="text-2xl tabular-nums tracking-wide text-[var(--color-fg)]">
          0
        </span>
        <span className="text-xs font-sans text-[var(--color-fg-muted)] uppercase tracking-wide">
          days
        </span>
      </div>
    </Card>
  );
}
