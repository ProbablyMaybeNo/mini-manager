import { Suspense } from "react";
import { currentUserId } from "@/lib/auth-stub";
import { ProjectInspector } from "@/components/projects/ProjectInspector";
import { listAllProjects } from "@/db/queries/projects";
import {
  getProjectPalettesMap,
  getProjectFirstRecipeMap,
  listOwnedRecipesLean,
} from "@/db/queries/recipes";
import { PageHeader } from "@/components/ui/PageHeader";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";
import { DashboardEventTicker } from "@/components/dashboard/DashboardEventTicker";
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
  formatTimeTotal,
  padCount,
} from "@/components/dashboard/dashboardKpiHelpers";
import { computeStreak } from "@/components/planner/plannerStreakHelpers";
import { getActivityByDay } from "@/db/queries/activityLog";
import { getAllTimeRollupSeconds } from "@/db/queries/paintSessions";
import { getFocusProjectId } from "@/db/queries/focus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { displayStatus, progressPercent, aggregateCounters } from "@/lib/progress";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";

/**
 * FOCUS-DASH (2026-06-04) — `/projects` is the DASHBOARD.
 *
 * Supersedes the D2 master-detail two-pane workspace: the IA restructure
 * unwinds the split + the detail inspector (detail-focus is gone, rows
 * already navigate to the project page) so the PROJECTS table spans full
 * width on every breakpoint. The planner widgets (calendar / activity /
 * streak) live here, below the table.
 *
 * FOCUS-FOLD (2026-06-08) — the FOCUS bench is back here too. It briefly
 * lived on a standalone /planner route (FOCUS-DASH); that route is now
 * removed and the bench folds in as the DashboardFocusSection below the
 * widget grid (see the interface comment + the JSX below).
 *
 * Surface (top to bottom):
 *   - Page header retitled DASHBOARD + the quick-add / import / new row.
 *   - KPI strip — big-number cards (active / avg completion / streak /
 *     painting time), the inverted-pyramid headline layer.
 *   - PROJECTS table (full-width, the existing dense desktop table + M3
 *     mobile comparison table inside `ProjectsDashboardTable`).
 *   - DASHBOARD widget row: activity + calendar (the relocated planner
 *     cells, reused verbatim) — the pyramid's detail layer.
 *   - FOCUS section — the folded-in painting bench (DashboardFocusSection).
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
 *
 * FOCUS-FOLD (2026-06-08) — the standalone `/planner` (Focus) route is
 * removed and FOCUS is dropped from the nav. The painting bench (TIMER +
 * the focused recipe with its per-paint notes + the INSPO board) folds
 * back onto this dashboard as the `DashboardFocusSection`, sitting below
 * the table/widget grid and above RecentlyBoughtLine — a dedicated "the
 * thing you use while painting" action section. The section self-fetches
 * its focus state; this page only threads the `?focusRecipe` / `?focusSlot`
 * persistence params (read from the same searchParams as the calendar's
 * `?calYear` / `?calMonth`).
 */
interface DashboardPageProps {
  /** P14.3 — calendar prev/next nav writes `?calYear` + `?calMonth`
   *  client-side via `router.replace`. The dashboard then re-renders the
   *  calendar widget against the new month. FOCUS-FOLD — the relocated
   *  FOCUS bench adds `?focusRecipe` (recipe-tab persistence) + `?focusSlot`
   *  (active-slot persistence) to the same param bag. Next hands
   *  searchParams as an awaited promise per the App-Router rules. */
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
  // FOCUS-FOLD — the relocated FOCUS bench persists its recipe-tab +
  // active-slot selection in the URL, exactly as the old /planner route did.
  const userId = await currentUserId();
  const now = new Date();
  const [
    allProjects,
    palettesByProjectId,
    firstRecipeByProjectId,
    ownedRecipes,
    streakDays,
    totalSeconds,
    focusProjectId,
  ] = await Promise.all([
    listAllProjects(userId),
    getProjectPalettesMap(userId),
    getProjectFirstRecipeMap(userId),
    listOwnedRecipesLean(userId),
    getActivityByDay(userId, new Date(now.getTime() - SIXTY_DAYS_MS)),
    getAllTimeRollupSeconds(userId),
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
      value: formatTimeTotal(totalSeconds),
      color: "cyan",
      valueAriaLabel: `${formatTimeTotal(totalSeconds)} total painting time`,
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

  // Container roll-up — an Army/Warband/Unit with no models of its own
  // (count === 0) shows the AGGREGATE status + progress + model total of
  // its whole subtree, so its row reads "how far along are all my units"
  // instead of a flat 0% (Ross's dashboard spec: an army of 7 units shows
  // the combined model completion). Leaf projects (count > 0) keep their
  // own counts.
  const childrenByParent = new Map<string, (typeof allProjects)[number][]>();
  for (const p of allProjects) {
    if (!p.parentId) continue;
    const siblings = childrenByParent.get(p.parentId);
    if (siblings) siblings.push(p);
    else childrenByParent.set(p.parentId, [p]);
  }
  const descendantsOf = (id: string): (typeof allProjects)[number][] => {
    const out: (typeof allProjects)[number][] = [];
    const stack = [...(childrenByParent.get(id) ?? [])];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      out.push(node);
      const kids = childrenByParent.get(node.id);
      if (kids) stack.push(...kids);
    }
    return out;
  };

  const rows: ProjectDashboardRow[] = allProjects.map((p) => {
    const rolled =
      p.count === 0 ? aggregateCounters(p, descendantsOf(p.id)) : null;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      faction: p.faction,
      priority: p.priority,
      status: displayStatus(rolled ? { ...rolled, isShelved: p.isShelved } : p),
      paletteHexes: palettesByProjectId.get(p.id) ?? [],
      progressPercent: progressPercent(rolled ?? p),
      totalModels: rolled ? rolled.count : p.count,
      updatedAt: p.updatedAt.getTime(),
      parentId: p.parentId,
      depth: depthOf(p.id),
      firstAttachedRecipeId: firstRecipeByProjectId.get(p.id) ?? null,
    };
  });

  return (
    <div className="content-cap p-6 md:p-8 space-y-6">
      {/* DASHBOARD-REDESIGN (Part B item 5) — header rebuilt to the mockup:
          a BIG legible logo + the stylistic DASHBOARD title on the left, two
          cyan CTAs on the right, and the redundant quick-add / search bar
          dropped (the ADD PROJECT button covers it, per Ross's comment). The
          DASHBOARD title is the stylistic terminal display face (shadow/glow
          via .title-display), sized up so it reads as the mission-control
          banner the mockup shows — terminal, not arcade. */}
      {/* FIGMA-REBUILD §3 — the Dashboard.png header is just the title +
          tagline; the ADD PROJECT (primary) / UPLOAD ARMY LIST (tertiary
          outline) CTAs live UNDER the PROJECTS table (rendered by
          DashboardProjectsTable), not duplicated up here. */}
      <PageHeader
        title="DASHBOARD"
        accent="green"
        tagline="Project hub, everything you need to manage your painting progress."
      />

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* DASH-KPI — the top KPI strip: the 5-second "where do I
              stand" answer, above the granular PROJECTS table per the
              inverted pyramid (doc §14/§4). */}
          <DashboardKpiStrip cards={kpiCards} />

          {/* DASHBOARD-POLISH (fix #3) — the bespoke ACTIVITY-TREND panel
              (area graph + sparkline + output-rate bar) was REMOVED here.
              Ross flagged it as a redundant section, and the mockup carries
              no trend panel: the same activity signal is already surfaced by
              the right-rail ACTIVITY tracker below, and COMPLETION % already
              owns the output-rate readout in the KPI strip. Dropping it
              tightens the dashboard to the mockup (KPIs → table + rail). */}

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
                <p className="mb-3 font-mono text-2xs uppercase tracking-[0.12em] text-[var(--color-green)]">
                  Overview of active projects and their progress
                </p>
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

          <DashboardEventTicker />
        </>
      )}

      <RecentlyBoughtLine />

      {/* FIGMA-REBUILD §9 — project detail is a slide-out inspector,
          opened when `?project=<id>` is present (row clicks land here). */}
      <Suspense fallback={null}>
        <ProjectInspector />
      </Suspense>
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
        <p className="text-sm text-[var(--color-fg-muted)] font-mono max-w-md mx-auto">
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
