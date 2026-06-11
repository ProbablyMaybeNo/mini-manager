import type { ActivityLogKind } from "@/db/schema";
import type { ActivityEntry } from "@/lib/types";

/** Activity-log row shape produced by `getRecentActivity` (queries/activityLog). */
export interface ActivityStreamRow {
  id: string;
  kind: ActivityLogKind;
  refId: string | null;
  createdAt: Date;
  displayName: string | null;
  parentRecipeName: string | null;
}

/** Activity kind → ActivityFeed glyph key (add/cart/build/prime/paint/check). */
const ICON: Record<ActivityLogKind, string> = {
  stage_bump: "check",
  recipe_created: "add",
  project_created: "add",
  paint_added: "cart",
  slot_added: "build",
  paint_session: "paint",
};

function text(row: ActivityStreamRow): string {
  const name = row.displayName?.trim();
  switch (row.kind) {
    case "stage_bump":
      return name ? `Advanced ${name}` : "Advanced a project stage";
    case "recipe_created":
      return name ? `Created recipe ${name}` : "Created a recipe";
    case "project_created":
      return name ? `Added ${name}` : "Added a project";
    case "paint_added":
      return name ? `Wishlisted ${name}` : "Wishlisted a paint";
    case "slot_added":
      return row.parentRecipeName
        ? `Added a layer to ${row.parentRecipeName}`
        : "Added a recipe layer";
    case "paint_session":
      return name ? `Painted ${name}` : "Logged a painting session";
  }
}

/** Relative "when" — coarse buckets are enough for the feed. */
function relativeWhen(when: Date, now: number): string {
  const sec = Math.max(0, Math.round((now - when.getTime()) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  return `${wk}w ago`;
}

export function toActivityEntry(row: ActivityStreamRow, now: number): ActivityEntry {
  return {
    id: row.id,
    icon: ICON[row.kind],
    text: text(row),
    when: relativeWhen(row.createdAt, now),
  };
}
