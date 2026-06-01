/**
 * P14.3 — Calendar widget render integration.
 *
 * The CalendarMonthGrid is a client component that owns
 * useState/useTransition/useRouter — running it through React in the
 * unit env (no fiber) blows up. We follow the same pattern the rest
 * of the dashboard's client-component tests use: pin structure via
 * source-string snapshots, plus integration tests on the server
 * actions (see tests/integration/actions/events.test.ts).
 *
 * Pins:
 *   - 7-column month grid (grid-cols-7)
 *   - coloured dot CSS var per event.kind
 *   - prev / next / Today nav
 *   - weekday labels Sun..Sat
 *   - legend with every kind label
 *   - AddEventForm mounted
 *   - role='grid' + aria-label on the month wrapper
 *   - today-cell highlight via accent ring
 *   - solid-fill Button discipline (no cyan / no [ ] brackets)
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("CalendarMonthGrid structure (P14.3)", () => {
  const src = read("src/components/planner/CalendarMonthGrid.tsx");

  test("uses a 7-column grid with weekday labels", () => {
    expect(src).toContain("grid-cols-7");
    for (const w of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(src).toContain(`"${w}"`);
    }
  });

  test("renders Prev / Today / Next nav buttons", () => {
    expect(src).toMatch(/Prev/);
    expect(src).toMatch(/Today/);
    expect(src).toMatch(/Next/);
    // The navigate() helper writes the cal* search params client-side.
    expect(src).toContain("calYear");
    expect(src).toContain("calMonth");
  });

  test("month wrapper has role='grid' + a month-name aria-label", () => {
    expect(src).toMatch(/role=["']grid["']/);
    expect(src).toMatch(/aria-label=\{`\$\{MONTH_NAMES\[focusedMonth\]\}/);
  });

  test("each event kind maps to the locked colour token", () => {
    // The KIND_DOT_CLASS lookup table is the single source of truth
    // for the dashboard dot colour palette. Pin every mapping so a
    // refactor can't quietly re-tint the dots.
    expect(src).toMatch(/tournament:\s*"bg-\[var\(--color-red\)\]"/);
    expect(src).toMatch(/deadline:\s*"bg-\[var\(--color-yellow\)\]"/);
    expect(src).toMatch(/battle:\s*"bg-\[var\(--color-purple-pastel\)\]"/);
    expect(src).toMatch(/other:\s*"bg-\[var\(--color-cyan\)\]"/);
  });

  test("renders a legend exposing every event-kind label", () => {
    expect(src).toContain('"Tournament"');
    expect(src).toContain('"Deadline"');
    expect(src).toContain('"Battle"');
    expect(src).toContain('"Other"');
  });

  test("today's cell is highlighted via the accent ring (not a bespoke hex)", () => {
    expect(src).toContain("ring-[var(--color-accent)]");
  });

  test("mounts the AddEventForm below the grid", () => {
    expect(src).toContain("<AddEventForm");
    // Pre-fills the date input when a day is expanded.
    expect(src).toMatch(/initialDate=\{expandedDayKey/);
  });

  test("invokes deleteEvent + updateEvent via server actions", () => {
    expect(src).toContain('from "@/lib/actions/events"');
    expect(src).toMatch(/deleteEvent\(/);
    expect(src).toMatch(/updateEvent\(/);
  });

  test("expand-on-click affords per-day edit + delete actions", () => {
    // Day-expansion panel renders an Edit button (ghost) + a Delete
    // button (danger), and swaps to an inline edit form on click.
    expect(src).toMatch(/variant=["']ghost["'][\s\S]*?>\s*Edit\s*</);
    expect(src).toMatch(/variant=["']danger["'][\s\S]*?>\s*Delete\s*</);
  });
});

describe("Calendar widget discipline (P14.3)", () => {
  const files = [
    "src/components/planner/CalendarMonthGrid.tsx",
    "src/components/planner/AddEventForm.tsx",
    "src/components/planner/PlannerCalendarCell.tsx",
  ];

  test("no raw hex literals in calendar surface (forces @theme tokens)", () => {
    const hexLiteral = /#[0-9a-fA-F]{3,8}\b/;
    for (const rel of files) {
      const src = read(rel);
      const noComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|\s)\/\/[^\n]*/g, "$1");
      expect(noComments, `raw hex in ${rel}`).not.toMatch(hexLiteral);
    }
  });

  test("no calendar Button uses cyan (P13.1)", () => {
    for (const rel of files) {
      const src = read(rel);
      expect(src).not.toMatch(/<Button[^>]+cyan/);
      expect(src).not.toMatch(/variant=["']cyan["']/);
    }
  });

  test("no calendar surface uses bracketed [ FOO ] action labels (P13.1)", () => {
    for (const rel of files) {
      const src = read(rel);
      // The auditor's bracket rule — [ FOO ] action-button text.
      expect(src).not.toMatch(/>\s*\[\s*[A-Z][A-Z\s]*\s*\]\s*</);
    }
  });
});

describe("Calendar mobile responsiveness (P14.8)", () => {
  const gridSrc = read("src/components/planner/CalendarMonthGrid.tsx");
  const cellSrc = read("src/components/planner/PlannerCalendarCell.tsx");

  test("month grid uses tighter padding + gap on mobile to clear tap-target floor", () => {
    // Frame wrapper inside the grid: p-1 on mobile, p-2 on sm+. The
    // 1px reduction reclaims ~8px of horizontal width — enough at
    // 375px to keep 7 day-cells > 35px wide.
    expect(gridSrc).toContain("p-1 sm:p-2");
    // Day-row gaps tighten too: 0.5 on mobile, 1 on sm+.
    expect(gridSrc).toMatch(/gap-0\.5 sm:gap-1/);
  });

  test("day cells keep a tap-friendly min-height on every viewport", () => {
    // 48px on mobile (>= 40px tap floor), 60px on sm+ for breathing room.
    expect(gridSrc).toContain("min-h-[48px]");
    expect(gridSrc).toContain("sm:min-h-[60px]");
  });

  test("CALENDAR card body shrinks its padding on mobile", () => {
    // Card-in-Card chrome eats grid width; the !-overrides beat the
    // global .card-body media-query padding.
    expect(cellSrc).toContain("bodyClassName");
    expect(cellSrc).toMatch(/!p-2\s+sm:!p-3\.5/);
  });
});

describe("PlannerCalendarCell wiring (P14.3)", () => {
  const src = read("src/components/planner/PlannerCalendarCell.tsx");

  test("preserves the locked empty-state copy", () => {
    expect(src).toMatch(/Your painting calendar/);
    expect(src).toMatch(/Add an event to start/);
  });

  test("renders inside a Card titled CALENDAR with the amber accent", () => {
    expect(src).toMatch(/title=["']CALENDAR["']/);
    expect(src).toMatch(/accentColor=["']amber["']/);
  });

  test("threads the calendar searchParams into the grid", () => {
    expect(src).toContain("CalendarMonthGrid");
    expect(src).toMatch(/calYear/);
    expect(src).toMatch(/calMonth/);
  });

  test("reads events via the dedicated query helper (no bespoke SQL)", () => {
    expect(src).toContain("listEventsInMonth");
  });
});

describe("AddEventForm structure (P14.3)", () => {
  const src = read("src/components/planner/AddEventForm.tsx");

  test("submits via createEvent server action", () => {
    expect(src).toContain('from "@/lib/actions/events"');
    expect(src).toMatch(/createEvent\(/);
  });

  test("has name + date + kind + notes form controls", () => {
    expect(src).toMatch(/type=["']text["']/);
    expect(src).toMatch(/type=["']date["']/);
    expect(src).toMatch(/<select/);
    expect(src).toMatch(/<textarea/);
  });

  test("uses solid-fill success variant for the Add button (P13.1 — CREATE intent)", () => {
    expect(src).toMatch(/variant=["']success["']/);
  });

  test("renders every event kind in the select", () => {
    expect(src).toContain("eventKinds");
    expect(src).toContain("tournament");
    expect(src).toContain("deadline");
    expect(src).toContain("battle");
    expect(src).toContain("other");
  });
});
