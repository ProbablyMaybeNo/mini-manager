import { WireframeGlobe } from "@/components/viz/WireframeGlobe";

/**
 * DashboardHero — the signature dashboard hero panel (audit UX-015). The
 * sign-in screen is carried by bespoke CRT art; the dashboard now gets its
 * own signature piece so the "wow" isn't on the gauges alone.
 *
 * The hero is the bespoke `WireframeGlobe` radar scope (DESIGN_LANGUAGE
 * §13, moodboard group 20) framed in the terminal `.panel` language, paired
 * with a terse mission-control readout. The readout restates numbers the
 * KPI strip already owns (active projects · avg completion · streak) — the
 * hero is the establishing shot, NOT the authoritative figure; the KPI
 * strip + table below remain the source of truth.
 *
 * Layout: the globe sits to the right on desktop and the readout to the
 * left. Below `md` the globe is HIDDEN (it would cram the column on a
 * phone) and only the compact readout band shows, so mobile keeps a clean
 * banner without losing the panel. Pure server component — the globe is
 * SSR-safe and the still frame renders complete.
 */

export interface DashboardHeroStat {
  /** Tiny tracked-out caption, e.g. "ACTIVE". */
  label: string;
  /** Mono headline value, e.g. "12" or "63%". */
  value: string;
  /** One of the phosphor tone tokens for the value glow. */
  tone: "cyan" | "green" | "amber" | "purple";
}

const TONE_TEXT: Record<DashboardHeroStat["tone"], string> = {
  cyan: "text-[var(--color-cyan)]",
  green: "text-[var(--color-green)]",
  amber: "text-[var(--color-amber)]",
  purple: "text-[var(--color-purple-pastel)]",
};

export interface DashboardHeroProps {
  /** The three glanceable establishing figures (active / avg / streak). */
  stats: DashboardHeroStat[];
}

export function DashboardHero({ stats }: DashboardHeroProps) {
  return (
    <section
      className="panel panel-ticks relative overflow-hidden p-5 md:p-6"
      aria-label="Workbench overview"
    >
      <span className="panel-label" aria-hidden>
        SYS ▸ SCOPE / LIVE
      </span>

      <div className="flex items-center justify-between gap-6">
        {/* Mission-control readout (left). */}
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.25em] text-[var(--color-cyan)]">
              SYS ▸ WORKBENCH
            </p>
            <h2 className="title-display text-sm md:text-base mt-2">
              ALL SYSTEMS SCANNING
            </h2>
            <p className="mt-2 max-w-md font-sans text-sm text-[var(--color-fg-muted)]">
              Your painting bench on the scope — every active project tracked,
              every contact a project in flight.
            </p>
          </div>

          {/* The three establishing figures — glanceable, mono, restated
              from the authoritative KPI strip below. */}
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <dt className="font-mono text-2xs uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                  {s.label}
                </dt>
                <dd
                  className={`font-mono text-xl md:text-2xl tabular-nums leading-none mt-1 glow-text-strong ${TONE_TEXT[s.tone]}`}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* The signature radar globe (right) — desktop only so it never
            crams the mobile column. Decorative: the figures above + the KPI
            strip below carry the data.
            DASHBOARD-REDESIGN (Part B item 4) — sized DOWN to read as the
            mockup's compact CRT hero graphic rather than a half-page globe. */}
        <div className="hidden md:flex shrink-0 items-center justify-center">
          <WireframeGlobe
            size={148}
            tone="cyan"
            blipTone="green"
            ariaLabel="Workbench radar — projects in flight"
          />
        </div>
      </div>
    </section>
  );
}
