import { currentUserId } from "@/lib/auth-stub";
import {
  getFocusedRecipeBundle,
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
import { Stopwatch, _formatRollup } from "@/components/focus/Stopwatch";
import { PlannerInspoCell } from "@/components/planner/PlannerInspoCell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Panel } from "@/components/ui/Panel";
import { buildFocusSlots } from "@/lib/focus/rollup";

/**
 * FOCUS-FOLD (2026-06-08) — the FOCUS bench folded into the DASHBOARD.
 *
 * Ross's locked decision: the standalone `/planner` (Focus) route is
 * removed and FOCUS is dropped from the nav; the bench the painter sits
 * in front of — TIMER, the focused recipe with its per-paint notes, and
 * the INSPO reference board — now lives as a compact section on the
 * `/projects` dashboard. This is "the thing you use while painting."
 *
 * This async server component is the relocated bench. It is a verbatim
 * lift of the old `app/planner/page.tsx` data layer + render — the focus
 * primitives (FocusPicker + FocusPanel + Stopwatch) and the reused
 * InspoGalleryGrid are NOT rebuilt, only moved here so they compose into
 * the dashboard. It self-fetches per-user focus state, so the dashboard
 * page stays force-dynamic without threading any focus data through.
 *
 * Search-param contract (unchanged from the old route, now read from the
 * dashboard's searchParams):
 *   - `?focusRecipe=<id>` — the FocusPanel tab strip persists which recipe
 *     the painter is reading (UX-907). Unknown / unowned ids fall back to
 *     the most-recently-updated recipe inside the query helper.
 *   - `?focusSlot=<zoneId>` — the active slot the painter is working on
 *     (P15.0). Unknown / unowned ids fall back to the first undone slot.
 *
 * Layout: a compact three-card stack anchored at `#focus` so the command
 * palette + any "jump to bench" link can deep-link to it. Mobile-first —
 * each card stacks to one column so it reads cleanly on a phone at the
 * bench, matching the terminal gold-standard panel language.
 */
interface DashboardFocusSectionProps {
  /** Recipe-tab persistence — `?focusRecipe=<id>` from the dashboard. */
  focusRecipeId?: string;
  /** Active-slot persistence — `?focusSlot=<zoneId>` from the dashboard. */
  focusSlotParam?: string;
}

export async function DashboardFocusSection({
  focusRecipeId,
  focusSlotParam,
}: DashboardFocusSectionProps) {
  const userId = await currentUserId();
  const [
    focusCandidates,
    focusBundle,
    paintMeta,
    inProgressSession,
    sessionRollups,
  ] = await Promise.all([
    listFocusCandidates(userId),
    getFocusedRecipeBundle(userId, focusRecipeId ?? null),
    getPaintMetaMap(),
    getInProgressSession(userId),
    getSessionRollups(userId),
  ]);

  // P15.0 — resolve which of the focused recipe's slots the painter has
  // marked done, scoped to this recipe's slot ids so the lookup stays
  // bounded. Done-state is per-painter (keyed on user + slot).
  const focusSlotIds = focusBundle ? focusBundle.slots.map((s) => s.id) : [];
  // P15.x — distinct paint ids across the focused recipe's paint-backed
  // slots. Per-paint notes are keyed on the paint, so we fetch the note map
  // bounded by these ids and thread the same note into every slot that
  // pins the paint.
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

  // P13.11 / P15.x — Build the FocusPanel's flat view model from the
  // bundle. Resolves paintId to brand+name+hex via the cached paint
  // catalog and threads each slot's per-painter done-state + the paint's
  // global note.
  const focusSlots: FocusSlotView[] = focusBundle
    ? buildFocusSlots(focusBundle.slots, paintMeta, completedSlotIds, paintNotesMap)
    : [];

  // P15.0 — resolve the active slot. Honour `?focusSlot` when it points at
  // a real slot in the focused recipe; otherwise default to the first
  // undone slot, falling back to the first slot when fully done.
  const activeSlotId: string | null = (() => {
    if (focusSlots.length === 0) return null;
    if (focusSlotParam && focusSlots.some((s) => s.id === focusSlotParam)) {
      return focusSlotParam;
    }
    const firstUndone = focusSlots.find((s) => !s.done);
    return firstUndone?.id ?? focusSlots[0]!.id;
  })();

  return (
    <section id="focus" aria-label="Focus bench" className="space-y-4">
      {/* Section header — a tracked-out coordinate caption above the
          display-font title, mirroring the dashboard's other section
          banners so FOCUS reads as one more mission-control surface, kept
          compact since it now lives inside the dashboard rather than
          owning a full screen. */}
      <header>
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
          SYS ▸ FOCUS / 01
        </p>
        <h2 className="title-display text-base md:text-lg">FOCUS</h2>
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans leading-relaxed">
          Sit down and paint. Pick what you&apos;re working on, read the
          recipe with its per-paint notes, run the stopwatch, and keep your
          reference board in reach.
        </p>
      </header>

      {/* The FOCUS bench: picker, then the recipe row + compact project
          panel (FocusPanel). */}
      <Card title="FOCUS" titleAs="h3" accentColor="green" ticks techLabel="SYS ▸ BENCH">
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

      {/* The bench stopwatch — its own compact card so the session timer
          reads as a distinct instrument.

          UX-014 — the TIMER card renders in EVERY state, not just when a
          project is focused: the stopwatch is the signature FOCUS feature,
          so a DISABLED shell (00:00 + greyed Start + a hint) keeps it
          discoverable before setup; the live Stopwatch swaps in once a
          project is focused. */}
      <Card
        title="TIMER"
        titleAs="h3"
        accentColor="cyan"
        ticks
        techLabel="SYS ▸ TIMER"
      >
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

      {/* The inspo reference board (reused verbatim). */}
      <PlannerInspoCell />
    </section>
  );
}

/**
 * UX-014 — disabled TIMER shell shown when no project is focused yet.
 * Mirrors the live Stopwatch's layout — readout at 00:00, a greyed-out
 * Start, and the Today·This week rollup — plus a one-line hint pointing at
 * the picker. Pure server markup (no interactivity), so the signature
 * stopwatch is visible + self-explanatory before any setup.
 */
function StopwatchEmptyShell({
  todaySeconds,
  weekSeconds,
}: {
  todaySeconds: number;
  weekSeconds: number;
}) {
  return (
    <div className="relative flex flex-wrap items-center gap-3" aria-disabled>
      <div className="flex flex-col">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Stopwatch
        </span>
        <span
          className="font-mono text-2xl tabular-nums tracking-wider text-[var(--color-fg-subtle)]"
          aria-label="Session timer ready"
        >
          00:00
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="success" size="sm" disabled>
          Start
        </Button>
      </div>

      <div className="flex flex-col basis-full text-left sm:basis-auto sm:ml-auto sm:text-right">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Today · This week
        </span>
        <span className="font-mono text-xs text-[var(--color-fg)]">
          {_formatRollup(todaySeconds)}{" "}
          <span className="text-[var(--color-fg-subtle)]">·</span>{" "}
          {_formatRollup(weekSeconds)}
        </span>
      </div>

      <p
        role="note"
        className="basis-full text-2xs font-mono text-[var(--color-fg-muted)]"
      >
        Pick a project to focus on above to start the bench timer.
      </p>
    </div>
  );
}

/**
 * P13.11 — Empty state for the FOCUS section. Differentiates between
 * "you have projects but none of them have recipes" (nudge toward
 * attaching one) and "you have recipes you could focus on right now"
 * (nudge toward picking one from the dropdown above).
 */
function FocusEmptyState({ hasCandidates }: { hasCandidates: boolean }) {
  return (
    <Panel ticks label="SYS ▸ STANDBY" className="p-4 space-y-2">
      <p className="text-sm font-sans text-[var(--color-fg)] leading-relaxed">
        Pick a project to focus on while you paint — its recipe will live
        here.
      </p>
      <p className="text-xs font-sans text-[var(--color-fg-muted)] leading-snug">
        {hasCandidates ? (
          <>
            Choose one from the picker above to see its slot grid + per-paint
            note fields, ready to scribble in.
          </>
        ) : (
          <>
            Attach a recipe from any project workspace first (open a project →
            tap a swatch in the Recipe box). Then it&apos;ll show up here as a
            focus target.
          </>
        )}
      </p>
    </Panel>
  );
}
