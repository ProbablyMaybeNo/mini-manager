/**
 * P14.4 — PlannerActivityCell unit tests.
 *
 * Two surfaces under test:
 *
 *   1. `sentenceFor(row)` — the human sentence for one activity row
 *      given its kind + resolved displayName. Covers all 5 kinds and
 *      the deleted-ref fallback.
 *   2. `formatRelative(then, now)` — the time-ago helper feeding the
 *      timestamp column. Pins the four threshold buckets + the
 *      absolute-date fallback.
 *
 * Component-shape assertions (does the widget render the right
 * structure?) live alongside the scaffold test in the same dir; the
 * integration test in tests/integration covers data-resolution end
 * to end.
 */
import { describe, expect, test } from "vitest";
import type { ActivityStreamRow } from "@/db/queries/activityLog";
import {
  formatRelative,
  sentenceFor,
} from "@/components/planner/plannerActivityHelpers";
import type { ActivityLogKind } from "@/db/schema";

function row(
  kind: ActivityLogKind,
  displayName: string | null,
  parentRecipeName: string | null = null,
): ActivityStreamRow {
  return {
    id: "x",
    kind,
    refId: "r",
    createdAt: new Date(0),
    displayName,
    parentRecipeName,
  };
}

describe("sentenceFor (P14.4)", () => {
  test("stage_bump uses 'Bumped <name>'", () => {
    expect(sentenceFor(row("stage_bump", "Salamanders"))).toBe(
      "Bumped Salamanders",
    );
  });

  test("recipe_created uses 'Created recipe <name>'", () => {
    expect(sentenceFor(row("recipe_created", "Bone White"))).toBe(
      "Created recipe Bone White",
    );
  });

  test("project_created uses 'Created project <name>'", () => {
    expect(sentenceFor(row("project_created", "Salamanders Army"))).toBe(
      "Created project Salamanders Army",
    );
  });

  test("paint_added with project name uses 'Added paint to <name>'", () => {
    expect(sentenceFor(row("paint_added", "Salamanders"))).toBe(
      "Added paint to Salamanders",
    );
  });

  test("paint_added without project name falls back to 'Bought paint'", () => {
    expect(sentenceFor(row("paint_added", null))).toBe("Bought paint");
  });

  test("slot_added uses 'Added slot to <parentRecipeName>'", () => {
    expect(sentenceFor(row("slot_added", "Armor", "Crimson Fists"))).toBe(
      "Added slot to Crimson Fists",
    );
  });

  test("slot_added falls back to zone name if parent recipe is null", () => {
    expect(sentenceFor(row("slot_added", "Armor", null))).toBe(
      "Added slot to Armor",
    );
  });

  test("each kind has a graceful unknown-entity fallback (deleted refs)", () => {
    expect(sentenceFor(row("stage_bump", null))).toBe("Bumped a project");
    expect(sentenceFor(row("recipe_created", null))).toBe("Created a recipe");
    expect(sentenceFor(row("project_created", null))).toBe(
      "Created a project",
    );
    expect(sentenceFor(row("slot_added", null))).toBe("Added a slot");
  });
});

describe("formatRelative (P14.4)", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  test("< 1 minute → '<1m'", () => {
    const then = new Date(now.getTime() - 30 * 1000);
    expect(formatRelative(then, now)).toBe("<1m");
  });

  test("at exactly the minute boundary → '1m'", () => {
    const then = new Date(now.getTime() - 60 * 1000);
    expect(formatRelative(then, now)).toBe("1m");
  });

  test("multi-minute range → 'Nm'", () => {
    const then = new Date(now.getTime() - 30 * 60 * 1000);
    expect(formatRelative(then, now)).toBe("30m");
  });

  test("multi-hour range → 'Nh'", () => {
    const then = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    expect(formatRelative(then, now)).toBe("4h");
  });

  test("23 hours still reads as hours, not days", () => {
    const then = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    expect(formatRelative(then, now)).toBe("23h");
  });

  test("1 day → '1 day ago' (singular)", () => {
    const then = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelative(then, now)).toBe("1 day ago");
  });

  test("multi-day range → 'N days ago'", () => {
    const then = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(formatRelative(then, now)).toBe("5 days ago");
  });

  test("7 days → '7 days ago' (still inside the days range)", () => {
    const then = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(formatRelative(then, now)).toBe("7 days ago");
  });

  test("> 7 days → absolute date 'Wkd D Mon'", () => {
    const then = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    // 14 days before 2026-06-01T12:00:00Z is 2026-05-18 (a Monday).
    expect(formatRelative(then, now)).toMatch(
      /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/,
    );
  });

  test("future timestamps degrade gracefully", () => {
    const then = new Date(now.getTime() + 60_000);
    expect(formatRelative(then, now)).toBe("just now");
  });
});
