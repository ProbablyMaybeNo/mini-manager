import { StatBox } from "@/components/kit";
import { formatMinutes, statBoxAccents } from "@/lib/palette";
import type { DashboardSummary } from "@/lib/types";

/** The four compact stat boxes: Active / Completion% / Streak / Time Total.
 *
 *  Per Ross's tracker feedback (qHYZN/4g3I/JxHyr): each box is just a centered
 *  title + its number, padded to two digits (01, 02, …) where it's a count.
 *  The meaningful readouts stay coloured — active cyan, completion green, streak
 *  yellow — while Time is neutral (colour contract §8) and flips red past a long
 *  session, the only "warning" semantic here. Pure display. */
export function StatRow({ summary }: { summary: DashboardSummary }) {
  // A session that has run long (8h+) flips Time to red as a gentle "take a
  // break" cue; otherwise it stays the neutral base (icu1mlFtJeya).
  const timeAccent = summary.timeTotalMinutes >= 8 * 60 ? "red" : statBoxAccents.time;
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {/* D5 / MM-49 / qHYZN — each centered tracker reads in its own style-guide
          hue so the row scans as four distinct readouts. Colours come from the
          shared statBoxAccents map; Time overrides to red past a long session. */}
      <StatBox
        center
        label="Active projects"
        value={String(summary.activeProjects).padStart(2, "0")}
        accent={statBoxAccents.active}
      />
      <StatBox
        center
        label="Completion %"
        value={`${summary.completionPercent}%`}
        accent={statBoxAccents.completion}
      />
      <StatBox
        center
        label="Streak"
        value={String(summary.streakDays).padStart(2, "0")}
        accent={statBoxAccents.streak}
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
