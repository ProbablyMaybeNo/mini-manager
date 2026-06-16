import { StatBox } from "@/components/kit";
import { formatMinutes, statBoxAccents } from "@/lib/palette";
import type { DashboardSummary } from "@/lib/types";

/** The four compact stat boxes: Active / Completion% / Streak / Time Total. Pure display. */
export function StatRow({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* D5 / MM-49 — each tracker box's total reads in its own style-guide
          hue so the row scans as four distinct readouts instead of the old
          cyan/green-only split. Active=cyan, Completion=green, Streak=yellow
          (a streak you don't want to break), Time=purple (cumulative). */}
      <StatBox
        label="Active projects"
        value={String(summary.activeProjects).padStart(2, "0")}
        accent={statBoxAccents.active}
      />
      <StatBox
        label="Completion %"
        value={`${summary.completionPercent}%`}
        accent={statBoxAccents.completion}
      />
      <StatBox
        label="Streak"
        value={String(summary.streakDays).padStart(2, "0")}
        accent={statBoxAccents.streak}
      />
      <StatBox
        label="Time Total"
        value={formatMinutes(summary.timeTotalMinutes)}
        accent={statBoxAccents.time}
      />
    </div>
  );
}
