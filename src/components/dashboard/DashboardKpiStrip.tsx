import { Card } from "@/components/ui/Card";
import {
  CircularProgress,
  type CircularProgressTone,
} from "@/components/ui/CircularProgress";
import { clsx } from "clsx";

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
 * PHASE-1 RE-SKIN (terminal rebuild, DESIGN_LANGUAGE §5/§7) — the strip is
 * re-skinned into mission-control STAT CARDS: each KPI is a near-black
 * Card carrying corner ticks (`ticks`) and a tiny coordinate-style tech
 * label on the top border (`techLabel`, e.g. `STAT ▸ 01`). The big number
 * renders in tabular-nums mono with the sanctioned phosphor glow; the unit
 * is a tracked-out mono caption. The LEAD metric (card index 0, top-left
 * per §4) takes the nested-border bezel + an extra-large readout so it
 * reads as the headline. Cyan is reserved for nav / CTA, so KPI NUMBERS
 * stay fg / green / amber / purple / muted — the corner ticks + tech label
 * carry the cyan-phosphor frame instead.
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
  /** Optional circular dial (DESIGN_LANGUAGE §7.1) shown beside the number
   *  for the headline-progress KPIs (avg completion, streak) — the
   *  recurring moodboard gauge. `percent` drives the sweep; `tone` locks
   *  the hue; `label`/`caption` override the centre readout (e.g. a raw
   *  streak count instead of a %). KPIs without a meaningful ratio omit
   *  it and keep the plain big number. */
  dial?: {
    percent: number;
    tone?: CircularProgressTone;
    label?: string;
    caption?: string;
    ariaLabel: string;
  };
}

interface Props {
  cards: ReadonlyArray<KpiCardData>;
}

/** Coordinate-style tech caption for the panel's top border — a diegetic
 *  registration tag (`STAT ▸ 01`) sequenced left → right. The lead card
 *  is flagged so its caption reads as the headline channel. */
function techLabelFor(index: number, lead: boolean): string {
  const n = String(index + 1).padStart(2, "0");
  return lead ? `LEAD ▸ ${n}` : `STAT ▸ ${n}`;
}

export function DashboardKpiStrip({ cards }: Props) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      aria-label="Dashboard at a glance"
      data-kpi-strip
    >
      {cards.map((card, index) => {
        // Lead metric (top-left, §4) carries the nested-border bezel + the
        // larger readout so it reads as the headline of the strip.
        const isLead = index === 0;
        return (
          <Card
            key={card.label}
            title={card.label}
            titleAs="h2"
            accentColor={card.accentColor}
            nested={isLead}
            ticks
            techLabel={techLabelFor(index, isLead)}
            bodyClassName="flex flex-col"
          >
            <div
              className="flex items-center justify-between gap-3"
              data-kpi-card
              data-kpi-lead={isLead ? "true" : undefined}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className={clsx(
                      "tabular-nums tracking-wide font-medium leading-none",
                      // Lead metric gets the larger readout; the rest stay
                      // at the strip's standard big-number size.
                      isLead ? "text-4xl" : "text-3xl",
                      card.valueClassName,
                      card.glowClassName,
                    )}
                    aria-label={card.valueAriaLabel}
                  >
                    {card.value}
                  </span>
                  <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
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
              {/* Circular phosphor dial for the headline-progress KPIs —
                  the recurring moodboard gauge (§7.1). */}
              {card.dial ? (
                <CircularProgress
                  percent={card.dial.percent}
                  tone={card.dial.tone}
                  label={card.dial.label}
                  caption={card.dial.caption}
                  ariaLabel={card.dial.ariaLabel}
                  size={isLead ? 64 : 56}
                  className="shrink-0"
                />
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
