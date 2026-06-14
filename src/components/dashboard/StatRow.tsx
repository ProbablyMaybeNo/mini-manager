import { StatBox } from "@/components/kit";
import { formatMinutes } from "@/lib/palette";
import type { DashboardSummary } from "@/lib/types";

/** The four compact stat boxes: Active / Completion% / Streak / Time Total. Pure display. */
export function StatRow({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Colour-role discipline (UX audit #5): neutral counts read cyan,
          positive/progress metrics read green. Yellow (warning) and purple
          (special) are reserved for real semantics, so they're not used here
          — "45% complete" in yellow used to read as a warning. */}
      <StatBox
        label="Active projects"
        value={String(summary.activeProjects).padStart(2, "0")}
        accent="cyan"
      />
      <StatBox label="Completion %" value={`${summary.completionPercent}%`} accent="green" />
      <StatBox
        label="Streak"
        value={String(summary.streakDays).padStart(2, "0")}
        accent="green"
      />
      <StatBox label="Time Total" value={formatMinutes(summary.timeTotalMinutes)} accent="cyan" />
    </div>
  );
}
