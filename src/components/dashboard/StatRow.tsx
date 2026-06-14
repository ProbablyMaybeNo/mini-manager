import { StatBox } from "@/components/kit";
import { formatMinutes } from "@/lib/palette";
import type { DashboardSummary } from "@/lib/types";

/** The four compact stat boxes: Active / Completion% / Streak / Time Total. Pure display. */
export function StatRow({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatBox
        label="Active projects"
        value={String(summary.activeProjects).padStart(2, "0")}
        accent="green"
      />
      <StatBox label="Completion %" value={`${summary.completionPercent}%`} accent="yellow" />
      <StatBox
        label="Streak"
        value={String(summary.streakDays).padStart(2, "0")}
        accent="purple"
      />
      <StatBox label="Time Total" value={formatMinutes(summary.timeTotalMinutes)} accent="cyan" />
    </div>
  );
}
