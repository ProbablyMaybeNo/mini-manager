import { currentUserId } from "@/lib/auth-stub";
import { listAllProjects } from "@/db/queries/projects";
import {
  getProjectPalettesMap,
  getProjectFirstRecipeMap,
  listOwnedRecipesLean,
} from "@/db/queries/recipes";
import { QuickAddBar } from "@/components/QuickAddBar";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { type ProjectDashboardRow } from "@/components/ProjectsDashboardTable";
import { DashboardProjectsTable } from "@/components/projects/DashboardProjectsTable";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import {
  DashboardKpiStrip,
  type KpiCardData,
} from "@/components/dashboard/DashboardKpiStrip";
import {
  activeProjectCount,
  averageCompletion,
  formatPaintTime,
} from "@/components/dashboard/dashboardKpiHelpers";
import {
  computeStreak,
  computeStreakBaseline,
  streakBaselineLine,
} from "@/components/planner/plannerStreakHelpers";
import { getActivityByDay } from "@/db/queries/activityLog";
import { getWeekRollupSeconds } from "@/db/queries/paintSessions";
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
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    getProjectFirstRecipeMap(userId),
    listOwnedRecipesLean(userId),
    getActivityByDay(userId, new Date(now.getTime() - SIXTY_DAYS_MS)),
    getWeekRollupSeconds(userId, now.getTime()),
  ]);

  const isEmpty = allProjects.length === 0;

  // DASH-KPI (2026-06-05) — the top KPI strip (doc §14/§4/§8). Every
  // metric is derived from the data fetched above + existing helpers; no
  // new tracking infra. The fourth card ("painting time this week") is a
  // SUBSTITUTE for "models painted this week" — paint_sessions records
  // duration, not model counts, so time-at-the-desk is the closest cheaply
  // derivable equivalent.
  const streak = computeStreak(streakDays, now);
  // DASH-STREAK-BASELINE (item 3, doc §8) — the streak's third context
  // layer: a WoW painting-day trend + the best-streak benchmark, both
  // derived from the same activity_log window the streak uses.
  const streakBaseline = streakBaselineLine(
    computeStreakBaseline(streakDays, now),
  );
  const isHotStreak = streak.streak >= 7;
  const isActiveStreak = streak.streak >= 1;
  const paintTime = formatPaintTime(weekSeconds);
  const kpiCards: KpiCardData[] = [
    {
      label: "ACTIVE PROJECTS",
      value: String(activeProjectCount(allProjects)),
      unit: "in flight",
      valueClassName: "text-[var(--color-fg)]",
      glowClassName: "glow-text-strong",
      accentColor: "green",
      valueAriaLabel: `${activeProjectCount(allProjects)} active projects`,
    },
    {
      label: "AVG COMPLETION",
      value: `${averageCompletion(allProjects)}%`,
      unit: "across projects",
      valueClassName: "text-[var(--color-fg)]",
      glowClassName: "glow-text-strong",
      accentColor: "amber",
      valueAriaLabel: `${averageCompletion(allProjects)} percent average completion`,
    },
    {
      label: "STREAK",
      value: String(streak.streak),
      unit: streak.streak === 1 ? "day" : "days",
      valueClassName: isHotStreak
        ? "text-[var(--color-green)]"
        : isActiveStreak
          ? "text-[var(--color-amber)]"
          : "text-[var(--color-fg-muted)]",
      glowClassName: isActiveStreak ? "glow-text-strong" : undefined,
      accentColor: "purple",
      valueAriaLabel: `${streak.streak} ${streak.streak === 1 ? "day" : "days"} streak`,
      baseline: streakBaseline ?? undefined,
    },
    {
      label: "PAINTING TIME",
      value: paintTime.value,
      unit: paintTime.unit,
      valueClassName: "text-[var(--color-fg)]",
      glowClassName: weekSeconds > 0 ? "glow-text-strong" : undefined,
      accentColor: "neutral",
      valueAriaLabel: `${paintTime.value} painting time this week`,
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
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          {/* PHASE-1 — page title takes the arcade display (Press Start 2P)
              treatment, kept SMALL per the spec (the pixel face is fatigue
              at any reading size). Pairs with a tracked-out coordinate
              system caption so the header reads as a mission-control
              screen banner, not a plain SaaS H1. */}
          <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
            SYS ▸ WORKBENCH / 00
          </p>
          <h1 className="title-display text-base md:text-lg">DASHBOARD</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-3 max-w-xl font-sans">
            Your wargaming workbench at a glance — every project, your
            painting rhythm, and your recipes, all on one screen.
          </p>
        </div>
        <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
          <QuickAddBar />
          <div className="flex gap-2 w-full md:w-[420px]">
            <Button
              as="a"
              href="/projects/import"
              variant="warning"
              size="sm"
              className="flex-1 justify-center"
            >
              Import army list
            </Button>
            <Button
              as="a"
              href="/projects/new"
              variant="success"
              size="sm"
              className="flex-1 justify-center"
            >
              New project
            </Button>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* DASH-KPI — the top KPI strip: the 5-second "where do I
              stand" answer, above the granular PROJECTS table per the
              inverted pyramid (doc §14/§4). */}
          <DashboardKpiStrip cards={kpiCards} />

          <Card title="PROJECTS" accentColor="cyan">
            <DashboardProjectsTable
              rows={rows}
              ownedRecipes={ownedRecipes}
              projectNameById={projectNameById}
            />
          </Card>
        </>
      )}

      {/* The planner widgets that moved here from the FOCUS screen. */}
      <DashboardWidgets calYear={calYear} calMonth={calMonth} />

      <RecentlyBoughtLine />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative frame p-8 text-center space-y-6 overflow-hidden">
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
