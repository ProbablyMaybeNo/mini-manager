import { currentUserId } from "@/lib/auth-stub";
import {
  getRecipeBundleForProject,
  getFocusedRecipeBundle,
  getFocusProjectId,
  listFocusCandidates,
} from "@/db/queries/focus";
import { getPaintMetaMap } from "@/db/queries/recipes";
import { getCompletedStepIds } from "@/db/queries/stepCompletion";
import { getPaintNotesMap } from "@/db/queries/paintNotes";
import {
  getInProgressSession,
  getSessionRollups,
} from "@/db/queries/paintSessions";
import { FocusPicker } from "@/components/focus/FocusPicker";
import {
  FocusPanel,
  type FocusSlotView,
} from "@/components/focus/FocusPanel";
import { Stopwatch } from "@/components/focus/Stopwatch";
import { PlannerInspoCell } from "@/components/planner/PlannerInspoCell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Panel } from "@/components/ui/Panel";
import { buildFocusSlots } from "@/lib/focus/rollup";
import {
  filledSegments,
  formatClock,
  formatRollup,
  progressBand,
  progressPercent,
  segmentCount,
} from "@/components/focus/focusPageLib";

interface Props {
  /** Launch context from `/focus?project=<id>` or the user's pinned focus. */
  projectId?: string | null;
  focusRecipeId?: string;
  focusSlotParam?: string;
}

/**
 * FOCUS full page body (REBUILD_SPEC §7) — painting session companion
 * with project picker, recipe bench, timer, progress bar, and inspo.
 */
export async function FocusPageSection({
  projectId: projectIdParam,
  focusRecipeId,
  focusSlotParam,
}: Props) {
  const userId = await currentUserId();
  const pinnedProjectId = await getFocusProjectId(userId);
  const projectId = projectIdParam ?? pinnedProjectId;

  const [
    focusCandidates,
    paintMeta,
    inProgressSession,
    sessionRollups,
  ] = await Promise.all([
    listFocusCandidates(userId),
    getPaintMetaMap(),
    getInProgressSession(userId),
    getSessionRollups(userId),
  ]);

  const focusBundle = projectId
    ? await getRecipeBundleForProject(userId, projectId, focusRecipeId ?? null)
    : await getFocusedRecipeBundle(userId, focusRecipeId ?? null);

  const focusSlotIds = focusBundle ? focusBundle.slots.map((s) => s.id) : [];
  const focusPaintIds = focusBundle
    ? Array.from(
        new Set(
          focusBundle.slots.flatMap((s) => (s.paintId ? [s.paintId] : [])),
        ),
      )
    : [];
  const [completedSlotIds, paintNotesMap] = await Promise.all([
    getCompletedStepIds(userId, focusSlotIds),
    getPaintNotesMap(userId, focusPaintIds),
  ]);

  const focusSlots: FocusSlotView[] = focusBundle
    ? buildFocusSlots(focusBundle.slots, paintMeta, completedSlotIds, paintNotesMap)
    : [];

  const activeSlotId: string | null = (() => {
    if (focusSlots.length === 0) return null;
    if (focusSlotParam && focusSlots.some((s) => s.id === focusSlotParam)) {
      return focusSlotParam;
    }
    const firstUndone = focusSlots.find((s) => !s.done);
    return firstUndone?.id ?? focusSlots[0]!.id;
  })();

  const complete = focusBundle?.project.completeCount ?? 0;
  const total = focusBundle?.project.count ?? 0;
  const pct = progressPercent(complete, total);
  const band = progressBand(pct);
  const segments = segmentCount(total);
  const filled = filledSegments(pct, segments);
  const bandColor =
    band === "red"
      ? "var(--color-red)"
      : band === "yellow"
        ? "var(--color-yellow)"
        : "var(--color-green)";

  return (
    <div className="mt-8 space-y-6">
      {focusBundle ? (
        <div className="panel panel-ticks relative px-4 py-3">
          <span className="panel-label" aria-hidden>
            PROJECT
          </span>
          <p className="font-mono text-lg text-[var(--color-green)]">
            {focusBundle.project.name}
            <span className="ml-2 text-sm text-[var(--color-fg-muted)]">
              ×{focusBundle.project.count}
            </span>
          </p>
        </div>
      ) : null}

      <Card title="FOCUS" titleAs="h2" accentColor="cyan" ticks techLabel="SYS ▸ BENCH">
        <div className="space-y-4">
          <FocusPicker
            options={focusCandidates.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              attachedRecipeName: c.attachedRecipeName,
            }))}
            currentFocusId={focusBundle?.project.id ?? null}
          />
          {focusBundle ? (
            <FocusPanel
              projectId={focusBundle.project.id}
              projectName={focusBundle.project.name}
              recipeName={focusBundle.recipe.name}
              slots={focusSlots}
              recipes={focusBundle.allRecipes}
              activeRecipeId={focusBundle.recipe.id}
              activeSlotId={activeSlotId}
              projectCounts={{
                buildCount: focusBundle.project.buildCount,
                primeCount: focusBundle.project.primeCount,
                paintCount: focusBundle.project.paintCount,
                completeCount: focusBundle.project.completeCount,
              }}
            />
          ) : (
            <FocusEmptyState hasCandidates={focusCandidates.length > 0} />
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="SESSION" titleAs="h2" accentColor="cyan" ticks techLabel="SYS ▸ TIMER">
          {focusBundle ? (
            <Stopwatch
              projectId={focusBundle.project.id}
              inProgressSession={
                inProgressSession
                  ? {
                      id: inProgressSession.id,
                      projectId: inProgressSession.projectId,
                      startedAt: inProgressSession.startedAt.getTime(),
                      pausedMs: inProgressSession.pausedMs,
                    }
                  : null
              }
              todaySeconds={sessionRollups.todaySeconds}
              weekSeconds={sessionRollups.weekSeconds}
            />
          ) : (
            <StopwatchEmptyShell
              todaySeconds={sessionRollups.todaySeconds}
              weekSeconds={sessionRollups.weekSeconds}
            />
          )}
        </Card>

        <Card
          title="PROGRESS BAR"
          titleAs="h2"
          accentColor="green"
          ticks
          techLabel="SYS ▸ PROGRESS"
        >
          <div className="space-y-3">
            <p className="font-mono text-2xl tabular-nums text-[var(--color-cyan)]">
              {formatClock(
                inProgressSession &&
                  focusBundle &&
                  inProgressSession.projectId === focusBundle.project.id
                  ? Math.max(
                      0,
                      Math.floor(
                        (Date.now() -
                          inProgressSession.startedAt.getTime() -
                          inProgressSession.pausedMs) /
                          1000,
                      ),
                    )
                  : 0,
              )}
            </p>
            <p className="font-mono text-xs text-[var(--color-fg-muted)]">
              + {complete}/{total} - · {pct}%
            </p>
            <div
              className="flex gap-0.5"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Project completion ${pct} percent`}
            >
              {Array.from({ length: segments }, (_, i) => (
                <span
                  key={i}
                  className="h-4 flex-1"
                  style={{
                    background:
                      i < filled ? bandColor : "var(--color-border-strong)",
                  }}
                />
              ))}
            </div>
            <p className="font-mono text-2xs text-[var(--color-fg-muted)]">
              Today {formatRollup(sessionRollups.todaySeconds)} · Week{" "}
              {formatRollup(sessionRollups.weekSeconds)}
            </p>
          </div>
        </Card>
      </div>

      <PlannerInspoCell />
    </div>
  );
}

function StopwatchEmptyShell({
  todaySeconds,
  weekSeconds,
}: {
  todaySeconds: number;
  weekSeconds: number;
}) {
  return (
    <div className="relative flex flex-wrap items-center gap-3" aria-disabled>
      <span className="font-mono text-2xl tabular-nums text-[var(--color-fg-subtle)]">
        00:00:00
      </span>
      <Button type="button" variant="success" size="sm" disabled>
        Start
      </Button>
      <p className="basis-full font-mono text-2xs text-[var(--color-fg-muted)]">
        Pick a project above to start a session. Today {formatRollup(todaySeconds)}{" "}
        · Week {formatRollup(weekSeconds)}
      </p>
    </div>
  );
}

function FocusEmptyState({ hasCandidates }: { hasCandidates: boolean }) {
  return (
    <Panel ticks label="SYS ▸ STANDBY" className="p-4 space-y-2">
      <p className="font-mono text-sm text-[var(--color-fg)]">
        NO SESSION LOADED — LAUNCH FOCUS FROM A PROJECT ON THE DASHBOARD.
      </p>
      <p className="font-mono text-xs text-[var(--color-fg-muted)]">
        {hasCandidates
          ? "Choose a project from the picker above."
          : "Attach a recipe to a project first, then return here."}
      </p>
      <Button as="a" href="/projects" variant="primary" size="sm">
        GO TO DASHBOARD
      </Button>
    </Panel>
  );
}
