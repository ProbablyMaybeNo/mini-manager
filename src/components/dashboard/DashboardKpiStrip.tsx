import { Card, type CardAccent } from "@/components/ui/Card";
import { clsx } from "clsx";

/**
 * DASH-KPI — the top KPI strip on the DASHBOARD.
 *
 * DASHBOARD-REDESIGN (Part B item 1) — rebuilt to match Ross's mockup:
 * four COLOR-CODED stat cards, each a title bar + a single big CENTERED
 * number, nothing else. The previous treatment (radial dials, baseline
 * lines, unit captions, left-aligned numbers) is dropped — the mockup is
 * "title + number only", which also reads cleaner against the inverted-
 * pyramid 5-second-glance bar.
 *
 * Cards (left → right, by attention drop-off — lead metric top-left):
 *   1. ACTIVE PROJECTS   green   — how many balls in the air (the lead).
 *   2. COMPLETION %      yellow  — how far along the whole workbench is.
 *   3. STREAK            purple  — am I keeping my rhythm.
 *   4. TIME TOTAL        cyan    — time at the bench this week.
 *
 * Each card's NUMBER + title accent + edge glow render in the card's hue
 * so the strip reads as four colour-coded readouts (the mockup), while the
 * card frame keeps the terminal corner-ticks + coordinate tech label.
 */

export type KpiColor = "green" | "yellow" | "purple" | "cyan";

export interface KpiCardData {
  /** Short uppercase label, e.g. "ACTIVE PROJECTS". */
  label: string;
  /** The big number / value string, e.g. "05", "45%", "03", "05:47". */
  value: string;
  /** The card's phosphor hue — drives the title accent, the big number
   *  colour, and the in-hue edge glow. */
  color: KpiColor;
  /** aria-label for the value (spells out the metric for screen readers). */
  valueAriaLabel: string;
}

const COLOR_TEXT: Record<KpiColor, string> = {
  green: "text-[var(--color-green)]",
  yellow: "text-[var(--color-yellow)]",
  purple: "text-[var(--color-purple-pastel)]",
  cyan: "text-[var(--color-cyan)]",
};

/** Card accent-bar hue mapping (Card's CardAccent vocabulary). */
const COLOR_ACCENT: Record<KpiColor, CardAccent> = {
  green: "green",
  yellow: "yellow",
  purple: "purple",
  cyan: "cyan",
};

interface Props {
  cards: ReadonlyArray<KpiCardData>;
}

/** Coordinate-style tech caption for the panel's top border — a diegetic
 *  registration tag (`STAT ▸ 01`) sequenced left → right. */
function techLabelFor(index: number): string {
  const n = String(index + 1).padStart(2, "0");
  return `STAT ▸ ${n}`;
}

export function DashboardKpiStrip({ cards }: Props) {
  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      aria-label="Dashboard at a glance"
      data-kpi-strip
    >
      {cards.map((card, index) => (
        <Card
          key={card.label}
          title={card.label}
          titleAs="h2"
          accentColor={COLOR_ACCENT[card.color]}
          ticks
          techLabel={techLabelFor(index)}
          bodyClassName="flex items-center justify-center"
          // Let a long KPI title wrap to two lines instead of ellipsizing
          // ("COMPLETION %", "TIME TOTAL") at narrow widths (UX-008).
          titleClassName="whitespace-normal leading-tight"
        >
          {/* The single big CENTERED number — the whole card body is just
              this readout (mockup: "title bar + big centered number only").
              tabular-nums keeps it anchored as values change; the sanctioned
              KPI glow + the card's hue make it the colour-coded headline. */}
          <span
            className={clsx(
              "block text-center tabular-nums tracking-wide font-medium leading-none py-2",
              "text-4xl lg:text-5xl",
              "glow-text-strong",
              COLOR_TEXT[card.color],
            )}
            data-kpi-value
            aria-label={card.valueAriaLabel}
          >
            {card.value}
          </span>
        </Card>
      ))}
    </div>
  );
}
