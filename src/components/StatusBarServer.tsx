import { listAllProjects, getProjectById } from "@/db/queries/projects";
import { getFocusProjectId } from "@/db/queries/focus";
import { getActivityByDay } from "@/db/queries/activityLog";
import { activeProjectCount } from "@/components/dashboard/dashboardKpiHelpers";
import { computeStreak } from "@/components/planner/plannerStreakHelpers";
import { StatusBar } from "@/components/StatusBar";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * StatusBarServer — gathers the top-strip numbers on the server and hands
 * them to the live-clock <StatusBar/>. Every metric reuses an existing
 * helper / query the app already relies on (no new tracking):
 *   - active projects → dashboardKpiHelpers.activeProjectCount over
 *     listAllProjects
 *   - streak          → plannerStreakHelpers.computeStreak over
 *     getActivityByDay (the same 60-day window the dashboard uses)
 *   - focus project   → getFocusProjectId → getProjectById name
 *
 * Failures degrade gracefully: any query error renders the bar with empty
 * stats rather than blowing up the whole app shell.
 */
export async function StatusBarServer({ userId }: { userId: string }) {
  const now = new Date();
  try {
    const [allProjects, focusProjectId, activityDays] = await Promise.all([
      listAllProjects(userId),
      getFocusProjectId(userId),
      getActivityByDay(userId, new Date(now.getTime() - SIXTY_DAYS_MS)),
    ]);

    const focusProject = focusProjectId
      ? await getProjectById(userId, focusProjectId)
      : null;

    const { streak } = computeStreak(activityDays, now);

    return (
      <StatusBar
        focusProjectName={focusProject?.name ?? null}
        activeProjects={activeProjectCount(allProjects)}
        streak={streak}
      />
    );
  } catch {
    return (
      <StatusBar focusProjectName={null} activeProjects={0} streak={0} />
    );
  }
}
