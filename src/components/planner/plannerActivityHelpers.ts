import type { ActivityStreamRow } from "@/db/queries/activityLog";

/**
 * P14.4 - Pure helpers for the activity stream widget.
 * Lives outside PlannerActivityCell.tsx so unit tests can import
 * them in node env without next-auth.
 */

export function sentenceFor(row: ActivityStreamRow): string {
  const name = row.displayName;
  switch (row.kind) {
    case "stage_bump":
      return name ? "Bumped " + name : "Bumped a project";
    case "recipe_created":
      return name ? "Created recipe " + name : "Created a recipe";
    case "project_created":
      return name ? "Created project " + name : "Created a project";
    case "paint_added":
      return name ? "Added paint to " + name : "Bought paint";
    case "slot_added":
      return name ? "Added slot to " + (row.parentRecipeName ?? name) : "Added a slot";
    case "paint_session":
      return name ? "Painted " + name : "Logged a paint session";
  }
}

export function formatRelative(then: Date, now: Date): string {
  const ms = now.getTime() - then.getTime();
  if (ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "<1m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  if (days <= 7) return days + " " + (days === 1 ? "day" : "days") + " ago";
  return absoluteDate(then);
}

function absoluteDate(d: Date): string {
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return weekday + " " + d.getDate() + " " + month;
}
