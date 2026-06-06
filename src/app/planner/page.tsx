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
import { Stopwatch } from "@/components/focus/Stopwatch";
import { PlannerInspoCell } from "@/components/planner/PlannerInspoCell";
import { Card } from "@/components/ui/Card";
import { buildFocusSlots } from "@/lib/focus/rollup";

export const dynamic = "force-dynamic";

/**
 * FOCUS-DASH (2026-06-04) — `/planner` is now the FOCUS screen: the
 * painting cockpit a painter sits in front of at the bench.
 *
 * Route decision: the path stays `/planner` (the typed-route + every
 * inbound link keep working) but the surface is retitled FOCUS in the
 * NavRail + the page H1. A clean `/focus` rename would ripple through the
 * typed `Route` references in NavRail + GlobalSearch + the command
 * palette for no user-visible gain, so we retitle-in-place per the
 * batch's low-churn guidance.
 *
 * The FOCUS bench (FocusPicker + FocusPanel + Stopwatch) MOVED here from
 * /projects, which becomes the DASHBOARD. The four sections are stacked
 * mobile-first so each one fits a single phone screen:
 *   1. Recipe row — the focused recipe's paints, each with its per-paint
 *      technique note surfaced inline (FocusPanel's slot palette + cards).
 *   2. Compact project panel — the focused unit/model/terrain/vehicle's
 *      stage counts + completion, smaller than the unit page (FocusPanel's
 *      header pill).
 *   3. Stopwatch — the bench session timer.
 *   4. Inspo gallery — paste-a-URL reference board (PlannerInspoCell).
 *
 * The calendar / activity / streak cells LEFT this screen for the
 * DASHBOARD (/projects) — the planner widgets now live alongside the
 * project table, not the painting bench.
 */
interface FocusPageProps {
  /** UX-907 — recipe-tab persistence. The FocusPanel's tab strip writes
   *  `?focusRecipe=<id>` so the painter's selection survives reloads.
   *  Unknown / unowned ids fall back to the most-recently-updated recipe
   *  inside the query helper. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FocusPage({ searchParams }: FocusPageProps) {
  const params = (await searchParams) ?? {};
  const focusRecipeRaw = params.focusRecipe;
  const focusRecipeId = Array.isArray(focusRecipeRaw)
    ? focusRecipeRaw[0]
    : focusRecipeRaw;
  // P15.0 — active-slot persistence. The FocusPanel's slot activator + the
  // "Advance slot" quick-action write `?focusSlot=<zoneId>` so the slot the
  // painter is working on survives reload. Unknown / unowned ids fall back
  // to the first slot with an undone step below.
  const focusSlotRaw = params.focusSlot;
  const focusSlotParam = Array.isArray(focusSlotRaw)
    ? focusSlotRaw[0]
    : focusSlotRaw;

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
    <div className="content-cap p-4 md:p-8 space-y-4 md:space-y-6">
      {/* Terminal hero — mirrors the dashboard + library banner so FOCUS
          reads as the same mission-control surface: a tracked-out
          coordinate caption above the display-font title, kept small. */}
      <header>
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
          SYS ▸ FOCUS / 01
        </p>
        <h1 className="title-display text-base md:text-lg">FOCUS</h1>
        <p className="text-xs text-[var(--color-fg-muted)] mt-2 max-w-xl font-sans leading-relaxed">
          Sit down and paint. Pick what you&apos;re working on, read the
          recipe with its per-paint notes, run the stopwatch, and keep your
          reference board in reach — each section fits one screen.
        </p>
      </header>

      {/* Sections 1–3: the FOCUS bench. Picker, then the recipe row +
          compact project panel (FocusPanel), then the stopwatch. */}
      <Card title="FOCUS" accentColor="green" ticks techLabel="SYS ▸ BENCH">
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
          ) : null}
        </div>
      </Card>

      {/* Section 4: the inspo reference board. */}
      <PlannerInspoCell />
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
    <div className="panel p-4 space-y-2">
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
    </div>
  );
}
