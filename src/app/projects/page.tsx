import { currentUserId } from "@/lib/auth-stub";
import { listAllProjects } from "@/db/queries/projects";
import {
  getProjectPalettesMap,
  getProjectFirstRecipeMap,
  listOwnedRecipesLean,
} from "@/db/queries/recipes";
import { Logo } from "@/components/ui/Logo";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { type ProjectDashboardRow } from "@/components/ProjectsDashboardTable";
import { DashboardProjectsTable } from "@/components/projects/DashboardProjectsTable";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  DashboardKpiStrip,
  type KpiCardData,
} from "@/components/dashboard/DashboardKpiStrip";
import {
  activeProjectCount,
  averageCompletion,
  formatTimeTotal,
  padCount,
  activityTrendSeries,
} from "@/components/dashboard/dashboardKpiHelpers";
import { DashboardTrendPanel } from "@/components/dashboard/DashboardTrendPanel";
import { computeStreak } from "@/components/planner/plannerStreakHelpers";
import { getActivityByDay } from "@/db/queries/activityLog";
import { getWeekRollupSeconds } from "@/db/queries/paintSessions";
import { getFocusProjectId } from "@/db/queries/focus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { displayStatus, progressPercent } from "@/lib/progress";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";

/**
 * FOCUS-DASH (2026-06-04) — `/projects` is the DASHBOARD.
 *
 * Supersedes the D2 master-detail two-pane workspace: the IA restructure
 * unwinds the split + the detail inspector (detail-focus is gone, rows
 * already navigate to the project page) so the PROJECTS table spans full
 * width on every breakpoint. The FOCUS bench MOVED to the FOCUS screen
 * (/planner); the planner widgets (calendar / activity / streak) MOVED
 * here, below the table.
 *
 * Surface (top to bottom):
 *   - Page header retitled DASHBOARD + the quick-add / import / new row.
 *   - KPI strip — big-number cards (active / avg completion / streak /
 *     painting time), the inverted-pyramid headline layer.
 *   - PROJECTS table (full-width, the existing dense desktop table + M3
 *     mobile comparison table inside `ProjectsDashboardTable`).
 *   - DASHBOARD widget row: activity + calendar (the relocated planner
 *     cells, reused verbatim) — the pyramid's detail layer.
 *   - RecentlyBoughtLine — passive spend readout (weakest real estate).
 *
 * DASH-RECIPES (2026-06-05) — the dashboard recipes table was removed.
 * /recipes is now the single primary surface for the recipe list, so the
 * dashboard no longer duplicates it. The grid re-balances around the
 * project table + widget row.
 *
 * DASH-PYRAMID (2026-06-05) — re-sequenced to the canonical inverted
 * pyramid (UXUI_DASHBOARD_DESIGN.md §4/§14): KPI strip → PROJECTS table
 * → Activity/Calendar → RecentlyBoughtLine. The Streak number moved up
 * into the KPI strip, so the Streak cell was dropped from the widget row
 * to avoid a duplicate headline.
 */
interface DashboardPageProps {
  /** P14.3 — calendar prev/next nav writes `?calYear` + `?calMonth`
   *  client-side via `router.replace`. The dashboard then re-renders the
   *  calendar widget against the new month. Next hands searchParams as an
   *  awaited promise per the App-Router rules. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const calYearRaw = params.calYear;
  const calMonthRaw = params.calMonth;
  const calYear = Array.isArray(calYearRaw) ? calYearRaw[0] : calYearRaw;
  const calMonth = Array.isArray(calMonthRaw) ? calMonthRaw[0] : calMonthRaw;

  const userId = await currentUserId();
  const now = new Date();
  const [
    allProjects,
    palettesByProjectId,
    firstRecipeByProjectId,
    ownedRecipes,
    streakDays,
    weekSeconds,
    focusProjectId,
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    getProjectFirstRecipeMap(userId),
    listOwnedRecipesLean(userId),
    getActivityByDay(userId, new Date(now.getTime() - SIXTY_DAYS_MS)),
    getWeekRollupSeconds(userId, now.getTime()),
    // UX-006 — the focused project drives the mission table's persistent
    // cyan "active row" highlight (keyed below). Null when no focus pinned.
    getFocusProjectId(userId),
  ]);

  const isEmpty = allProjects.length === 0;

  // DASH-KPI (doc §14/§4/§8) — the top KPI strip. Every metric is derived
  // from the data fetched above + existing helpers; no new tracking infra.
  //
  // DASHBOARD-REDESIGN (Part B item 1) — rebuilt to Ross's mockup: four
  // COLOR-CODED cards, each just a title bar + a big centred number. The
  // dials / baseline lines / unit captions are dropped (the mockup is
  // "title + number only"). The fourth card is TIME TOTAL — time at the
  // bench this week, the closest cheaply-derivable "output" metric since
  // paint_sessions records duration, not model counts.
  const streak = computeStreak(streakDays, now);
  const avgCompletion = averageCompletion(allProjects);
  // PHASE-1 viz — the activity-trend series for the bespoke AREA GRAPH /
  // SPARKLINE (DESIGN_LANGUAGE §13). Re-uses the SAME 60-day activity_log
  // window already fetched for the streak (no new query) and gap-fills it
  // to a contiguous daily-count series, oldest → newest.
  const TREND_DAYS = 60;
  const trendSeries = activityTrendSeries(streakDays, now, TREND_DAYS);
  const activeCount = activeProjectCount(allProjects);
  const kpiCards: KpiCardData[] = [
    {
      label: "ACTIVE PROJECTS",
      value: padCount(activeCount),
      color: "green",
      valueAriaLabel: `${activeCount} active projects`,
    },
    {
      label: "COMPLETION %",
      value: `${avgCompletion}%`,
      color: "yellow",
      valueAriaLabel: `${avgCompletion} percent average completion`,
    },
    {
      label: "STREAK",
      value: padCount(streak.streak),
      color: "purple",
      valueAriaLabel: `${streak.streak} ${streak.streak === 1 ? "day" : "days"} streak`,
    },
    {
      label: "TIME TOTAL",
      value: formatTimeTotal(weekSeconds),
      color: "cyan",
      valueAriaLabel: `${formatTimeTotal(weekSeconds)} painting time this week`,
    },
  ];

  // Build name lookup so the inline AttachRecipeModal can label recipes
  // that are currently attached elsewhere.
  const projectNameById: Record<string, string> = {};
  for (const p of allProjects) projectNameById[p.id] = p.name;

  // Compute depth per project: 0 for top-level, 1 for children, 2 for
  // grandchildren. Three-level cap is enforced application-side.
  const projectById = new Map<string, (typeof allProjects)[number]>();
  for (const p of allProjects) projectById.set(p.id, p);
  const depthCache = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    const node = projectById.get(id);
    if (!node) return 0;
    const d = node.parentId ? depthOf(node.parentId) + 1 : 0;
    depthCache.set(id, d);
    return d;
  };

  const rows: ProjectDashboardRow[] = allProjects.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    faction: p.faction,
    priority: p.priority,
    status: displayStatus(p),
    paletteHexes: palettesByProjectId.get(p.id) ?? [],
    progressPercent: progressPercent(p),
    totalModels: p.count,
    updatedAt: p.updatedAt.getTime(),
    parentId: p.parentId,
    depth: depthOf(p.id),
    firstAttachedRecipeId: firstRecipeByProjectId.get(p.id) ?? null,
  }));

  return (
    <div className="content-cap p-6 md:p-8 space-y-6">
      {/* DASHBOARD-REDESIGN (Part B item 5) — header rebuilt to the mockup:
          a BIG legible logo + the stylistic DASHBOARD title on the left, two
          cyan CTAs on the right, and the redundant quick-add / search bar
          dropped (the ADD PROJECT button covers it, per Ross's comment). The
          DASHBOARD title is the stylistic terminal display face (shadow/glow
          via .title-display), sized up so it reads as the mission-control
          banner the mockup shows — terminal, not arcade. */}
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* The brand logo, sized like the sign-in lockup so "mini-manager"
              actually reads. mix-blend screen drops the PNG's black ground. */}
          <Logo
            width={56}
            decorative
            className="shrink-0 hidden sm:block"
          />
          <div className="min-w-0">
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
              SYS ▸ WORKBENCH / 00
            </p>
            <h1 className="title-display text-2xl md:text-4xl leading-none">
              DASHBOARD
            </h1>
            {/* One-line subheading (research §3 — orients the 5-second
                glance). Kept terse so the header stays the clean mockup
                banner rather than a paragraph. */}
            <p className="text-2xs md:text-xs text-[var(--color-fg-muted)] mt-2 tracking-wide">
              Your wargaming workbench at a glance.
            </p>
          </div>
        </div>
        {/* Two cyan CTAs (mockup): ADD PROJECT + UPLOAD ARMY LIST. Both
            primary-cyan per the mockup — this supersedes the prior
            success-green / warning-yellow split for the dashboard header. */}
        <div className="flex gap-2 w-full md:w-auto">
          <Button
            as="a"
            href="/projects/new"
            variant="primary"
            size="md"
            className="flex-1 md:flex-none justify-center"
          >
            Add project
          </Button>
          <Button
            as="a"
            href="/projects/import"
            variant="primary"
            tone="outline"
            size="md"
            className="flex-1 md:flex-none justify-center"
          >
            Upload army list
          </Button>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* UX-015 — the signature dashboard HERO: the bespoke WireframeGlobe
              radar scope framed in the terminal panel language, the dashboard
              counterpart to the sign-in CRT art so the "wow" isn't on the
              gauges alone. Establishing shot only — the figures it shows are
              restated from the authoritative KPI strip directly below; the
              globe is desktop-only so it never crams the mobile column. */}
          <DashboardHero
            stats={[
              {
                label: "ACTIVE",
                value: String(activeProjectCount(allProjects)),
                tone: "green",
              },
              { label: "AVG COMPLETION", value: `${avgCompletion}%`, tone: "amber" },
              { label: "STREAK", value: `${streak.streak}d`, tone: "purple" },
            ]}
          />

          {/* DASH-KPI — the top KPI strip: the 5-second "where do I
              stand" answer, above the granular PROJECTS table per the
              inverted pyramid (doc §14/§4). */}
          <DashboardKpiStrip cards={kpiCards} />

          {/* PHASE-1 viz — the bespoke activity-trend panel (area graph +
              sparkline + segmented output-rate bar), reading like moodboard
              groups 20 + 27. Sits between the headline KPIs and the
              granular table per the inverted pyramid. */}
          <DashboardTrendPanel
            trend={trendSeries}
            windowDays={TREND_DAYS}
            avgCompletion={avgCompletion}
          />

          {/* DASHBOARD-REDESIGN (Part B items 2/3) — the mockup's main row:
              the PROJECTS mission table on the left (wide) beside the RIGHT
              RAIL (compact scrollable PLANNER calendar + ACTIVITY tracker).
              On `lg+` the table takes 2 of 3 columns and the rail the third;
              below `lg` the rail stacks under the table. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 min-w-0">
              <Card
                title="PROJECTS"
                accentColor="cyan"
                ticks
                techLabel="DB ▸ PROJECTS"
              >
                <DashboardProjectsTable
                  rows={rows}
                  ownedRecipes={ownedRecipes}
                  projectNameById={projectNameById}
                  focusProjectId={focusProjectId}
                />
              </Card>
            </div>
            {/* Right rail — the relocated planner widgets, now stacked. */}
            <aside className="lg:col-span-1 min-w-0" aria-label="Planner & activity">
              <DashboardWidgets calYear={calYear} calMonth={calMonth} />
            </aside>
          </div>
        </>
      )}

      <RecentlyBoughtLine />
    </div>
  );
}

function EmptyState() {
  return (
    // PHASE-1 cohesion — the empty state is a terminal panel (ticks +
    // coordinate label) so the very first thing a new painter sees already
    // reads as the mission-control surface, not a grey SaaS box.
    <div className="panel panel-ticks relative p-8 text-center space-y-6 overflow-hidden">
      <span className="panel-label" aria-hidden>
        DB ▸ EMPTY
      </span>
      <div>
        <h2 className="text-lg glow-cyan mb-3">No projects yet</h2>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-md mx-auto">
          Start with anything you&apos;re painting — an army, a warband, a
          single mini, or a piece of terrain. Sub-projects let you nest units
          inside armies.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button as="a" href="/projects/import" variant="warning" size="sm">
          Import army list
        </Button>
        <Button as="a" href="/projects/new" variant="success" size="sm">
          Create first project
        </Button>
      </div>
      <p className="text-xs font-mono text-[var(--color-fg-muted)]">
        Got a BattleScribe roster or a Warhammer App PDF? Drop it in and
        we&apos;ll populate the project tree in seconds.
      </p>
    </div>
  );
}
