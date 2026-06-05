import { Card } from "@/components/ui/Card";

/**
 * DASH-KPI (2026-06-05) — the top KPI strip on the DASHBOARD.
 *
 * Doc §14 "DASHBOARD — page composition" + §4 + §8: a thin strip of
 * big-number KPI cards at the very top of /projects, above the PROJECTS
 * table — the 5-second "where do I stand" answer. The inverted-pyramid
 * headline layer: KPIs top → table → detail widgets → spend line.
 *
 * Cards (left → right, by attention drop-off §4 — lead metric top-left):
 *   1. Active projects   — how many balls in the air (the lead).
 *   2. Avg completion    — how far along the whole workbench is.
 *   3. Streak            — am I keeping my rhythm (promoted from the
 *                          bottom-of-page widget; doc §14 calls this out).
 *   4. Painting time wk  — substitute for "models painted this week":
 *                          paint_sessions tracks duration, not model
 *                          counts, so the closest derivable metric is
 *                          time at the desk this week.
 *
 * Presentational only — the page computes every value from data it
 * already fetches (see DashboardKpiStrip usage in projects/page.tsx).
 * Big tabular-nums numbers, label-led, no decorative chrome on data
 * (§6/§13). Reuses the Card primitive + the hue-matched KPI `glow-*`
 * utilities just added to globals.css.
 */

export interface KpiCardData {
  /** Short uppercase label, e.g. "ACTIVE PROJECTS". */
  label: string;
  /** The big number / value string, e.g. "4", "62%", "8h 12m". */
  value: string;
  /** Small unit / qualifier under the number, e.g. "in flight", "avg". */
  unit: string;
  /** Token colour class for the number, e.g. "text-[var(--color-green)]".
   *  Status-coloured KPIs (streak) pass green/amber/muted; neutral KPIs
   *  pass the default fg. Never cyan (reserved for nav/CTA). */
  valueClassName: string;
  /** Optional glow utility hue, paired with the value colour. KPIs are
   *  the one place glow on a number is sanctioned (globals.css comment). */
  glowClassName?: string;
  /** Optional third-context-layer baseline line under the number
   *  (doc §8) — e.g. the streak's "best 9 · 3 this wk vs 1 last". */
  baseline?: string;
  /** Accent bar hue on the card header. */
  accentColor: "cyan" | "green" | "amber" | "purple" | "neutral";
  /** aria-label for the value (spells out the unit for screen readers). */
  valueAriaLabel: string;
}

interface Props {
  cards: ReadonlyArray<KpiCardData>;
}

export function DashboardKpiStrip({ cards }: Props) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      aria-label="Dashboard at a glance"
      data-kpi-strip
    >
      {cards.map((card) => (
        <Card
          key={card.label}
          title={card.label}
          titleAs="h2"
          accentColor={card.accentColor}
          bodyClassName="flex flex-col"
        >
          <div className="frame p-3 space-y-1" data-kpi-card>
            <div className="flex items-baseline gap-2">
              <span
                className={
                  "text-3xl tabular-nums tracking-wide font-medium " +
                  card.valueClassName +
                  (card.glowClassName ? " " + card.glowClassName : "")
                }
                aria-label={card.valueAriaLabel}
              >
                {card.value}
              </span>
              <span className="text-xs font-sans text-[var(--color-fg-muted)] uppercase tracking-wide">
                {card.unit}
              </span>
            </div>
            {card.baseline ? (
              <p
                className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-subtle)]"
                data-kpi-baseline
              >
                {card.baseline}
              </p>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
