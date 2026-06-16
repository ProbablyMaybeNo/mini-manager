import { StatBox } from "@/components/kit";
import { formatMinutes } from "@/lib/palette";
import type { DashboardSummary } from "@/lib/types";

/** The four compact stat boxes: Active / Completion% / Streak / Time Total.
 *
 *  Per Ross's tracker feedback (qHYZN/4g3I/JxHyr): each box is just a centered
 *  title + its number, padded to two digits (01, 02, …) where it's a count.
 *  One colour per box so the dashboard reads at a glance — active green,
 *  completion yellow, streak purple, time cyan (flips red past a long session,
 *  the only "warning" semantic here). Pure display. */
export function StatRow({ summary }: { summary: DashboardSummary }) {
  // A session that has run long (8h+) flips Time to red as a gentle "take a
  // break" cue; otherwise it stays cyan.
  const timeAccent = summary.timeTotalMinutes >= 8 * 60 ? "red" : "cyan";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatBox
        center
        label="Active projects"
        value={String(summary.activeProjects).padStart(2, "0")}
        accent="green"
      />
      <StatBox center label="Completion %" value={`${summary.completionPercent}%`} accent="yellow" />
      <StatBox
        center
        label="Streak"
        value={String(summary.streakDays).padStart(2, "0")}
        accent="purple"
      />
      <StatBox
        center
        label="Time Total"
        value={formatMinutes(summary.timeTotalMinutes)}
        accent={timeAccent}
      />
    </div>
  );
}
