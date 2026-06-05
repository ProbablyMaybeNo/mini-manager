import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/auth-stub";
import {
  getRecentActivity,
  type ActivityStreamRow,
} from "@/db/queries/activityLog";
import type { ActivityLogKind } from "@/db/schema";
import {
  formatRelative,
  sentenceFor,
} from "./plannerActivityHelpers";

/**
 * P14.4 - Activity stream widget. Async server component; defaults
 * to fetching last-20 rows for the current user when called with no
 * props (matches the P14.3 sibling-cell pattern). Empty-state copy
 * preserved from the P14.2 scaffold so the visual remains stable.
 */

interface Props {
  rows?: ReadonlyArray<ActivityStreamRow>;
  now?: Date;
}

const KIND_GLYPH: Record<ActivityLogKind, string> = {
  stage_bump: "^",
  recipe_created: "*",
  project_created: "+",
  paint_added: "o",
  slot_added: "[]",
  paint_session: "~",
};

const KIND_LABEL: Record<ActivityLogKind, string> = {
  stage_bump: "bump",
  recipe_created: "recipe",
  project_created: "project",
  paint_added: "paint",
  slot_added: "slot",
  paint_session: "session",
};

export async function PlannerActivityCell({ rows, now }: Props = {}) {
  const resolvedRows =
    rows ?? (await getRecentActivity(await currentUserId(), 20));
  const referenceNow = now ?? new Date();

  if (resolvedRows.length === 0) {
    return (
      <Card
        title="ACTIVITY"
        titleAs="h3"
        accentColor="green"
        className="h-full"
        bodyClassName="flex-1 flex flex-col"
      >
        <div className="frame p-3 flex-1">
          <p className="text-sm font-sans text-[var(--color-fg-muted)] leading-relaxed">
            No activity yet. Bump a stage or create a recipe to
            populate the stream.
          </p>
        </div>
      </Card>
    );
  }

  return (
    // DASH-PROPORTION — `h-full` lets the card fill its dashboard grid
    // cell. The list is capped + scrolls (`min-h-0 overflow-y-auto`) so a
    // long activity stream can't grow the cell taller than the calendar
    // it sits beside; the trio stays a clean rectangle.
    <Card
      title="ACTIVITY"
      titleAs="h3"
      accentColor="green"
      className="h-full"
      bodyClassName="flex-1 flex flex-col min-h-0"
    >
      <ol className="frame p-3 space-y-2 list-none flex-1 min-h-0 overflow-y-auto">
        {resolvedRows.map((row) => (
          <li
            key={row.id}
            className="flex items-baseline gap-2 text-sm font-sans leading-snug"
          >
            <span
              aria-label={KIND_LABEL[row.kind]}
              className="inline-flex w-4 shrink-0 justify-center tabular-nums text-[var(--color-green)]"
            >
              {KIND_GLYPH[row.kind]}
            </span>
            <span className="flex-1 min-w-0 text-[var(--color-fg)] break-words">
              {sentenceFor(row)}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-[var(--color-fg-muted)] whitespace-nowrap">
              {formatRelative(row.createdAt, referenceNow)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
