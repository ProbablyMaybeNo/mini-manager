import { PlannerSection } from "@/components/planner/PlannerSection";
import { RecentlyBoughtLine } from "@/components/dashboard/RecentlyBoughtLine";

export const dynamic = "force-dynamic";

/**
 * D6 — `/planner` single-screen dashboard (desktop-surfaced via the
 * NavRail; renders responsively so a deep-linked mobile visitor still
 * gets the cluster).
 *
 * Decisions block (2026-06-03 §3): the desktop master-detail `/projects`
 * workspace (D2) has no pane for the planner widgets, so PLANNER gets its
 * own route on desktop while mobile reaches the same widgets via the
 * collapsed PLANNER disclosure on /projects (M4). Both containers mount
 * the SAME `<PlannerSection>` shared cluster — verified shared-ready in
 * Group 2 step 2 — so the widgets never fork.
 *
 * The route is a thin shell: a width-capped (.content-cap, D1) wrapper, a
 * page header, and the shared cluster. The cluster ships its own
 * single-screen 12-col-style dashboard grid (COLLECTION canvas hero +
 * calendar + streak + activity + inspo) and self-fetches via its child
 * cells, so this page only has to thread the calendar's `?calYear` /
 * `?calMonth` search-params — exactly as `src/app/projects/page.tsx`
 * does — and otherwise gets out of the way.
 */
interface PlannerPageProps {
  /** D6 — calendar prev/next nav writes `?calYear` + `?calMonth`
   *  client-side via `router.replace`; the planner then re-renders the
   *  PLANNER calendar against the new month. Next hands searchParams as
   *  an awaited promise per the App-Router rules. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlannerPage({
  searchParams,
}: PlannerPageProps) {
  const params = (await searchParams) ?? {};
  const calYearRaw = params.calYear;
  const calMonthRaw = params.calMonth;
  const calYear = Array.isArray(calYearRaw) ? calYearRaw[0] : calYearRaw;
  const calMonth = Array.isArray(calMonthRaw) ? calMonthRaw[0] : calMonthRaw;

  return (
    <div className="content-cap p-6 md:p-8 space-y-6">
      <header>
        <h1 className="text-3xl tracking-wide">PLANNER</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans">
          Your painting cockpit at a glance — collection coverage, your
          streak, the latest activity, the calendar, and your reference
          board, all on one screen.
        </p>
      </header>

      <PlannerSection calYear={calYear} calMonth={calMonth} />

      <RecentlyBoughtLine />
    </div>
  );
}
