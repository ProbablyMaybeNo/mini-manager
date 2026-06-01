/**
 * Phase 14 Round 11 polish cluster (UX-1101, UX-1102, UX-1105, UX-1106,
 * UX-1107, UX-1108). Each pin guards one finding from the v11 audit
 * so the regression can't sneak back in.
 *
 * UX-1103 (broken-image fallback) + UX-1104 (calMonth 1-indexed URL
 * contract) ship in their own commits with their own targeted tests.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("UX-1101 — Streak headline + microcopy pluralisation", () => {
  const cell = read("src/components/planner/PlannerStreakCell.tsx");

  test("streak headline label pluralises on count", () => {
    // count === 1 -> 'DAY'; otherwise 'DAYS'. The cell derives the
    // label from result.streak instead of hard-coding 'days'.
    expect(cell).toMatch(/result\.streak\s*===\s*1\s*\?\s*"DAY"\s*:\s*"DAYS"/);
  });

  test("streak aria-label pluralises on count", () => {
    // The number's aria-label reads "1 day" / "3 days" — not "1 days".
    expect(cell).toMatch(/result\.streak\s*===\s*1\s*\?\s*"day"\s*:\s*"days"/);
  });

  test("microcopy uses em-dash, not ASCII hyphen, around the nudge", () => {
    const helpers = read("src/components/planner/plannerStreakHelpers.ts");
    // No `count days - don't break the chain` (ASCII hyphen). Must be
    // em-dash to match the rest of the app's punctuation style.
    expect(helpers).not.toMatch(/days - don't break the chain/);
    expect(helpers).toContain("— don't break the chain.");
    expect(helpers).toContain("— keep it up.");
    expect(helpers).toContain("— break it open.");
  });
});

describe("UX-1102 — SAVE ORDER button uses success variant (P13.1)", () => {
  const src = read("src/components/planner/ManageInspoModal.tsx");

  test("Save order button is variant=success (green save/create idiom)", () => {
    // Pin the Button block that wraps the "Save order" label. The
    // surrounding regex is loose enough to survive prop reordering
    // but strict enough to fail if anyone reverts to primary (cyan).
    expect(src).toMatch(
      /<Button[\s\S]{0,200}variant=["']success["'][\s\S]{0,200}>\s*Save order/,
    );
  });

  test("Save order button is NOT primary (cyan banned on actions)", () => {
    // P13.1 — cyan reserved for status dots + links, never action
    // buttons. Save order is an action button.
    expect(src).not.toMatch(
      /<Button[\s\S]{0,200}variant=["']primary["'][\s\S]{0,200}>\s*Save order/,
    );
  });
});

describe("UX-1105 — Calendar day aria-labels are screen-reader prose", () => {
  const src = read("src/components/planner/CalendarMonthGrid.tsx");

  test("aria-label is built from MONTH_NAMES + day + year, not the raw ISO key", () => {
    // The replacement reads "June 8, 2026, 1 event" instead of
    // "2026-06-08 · 1 event(s)". Pin the substitution shape.
    expect(src).toContain("MONTH_NAMES[cellMonth]");
    // Today's cell gets the prefix "Today, " so screen readers say
    // "Today, June 1, 2026".
    expect(src).toMatch(/Today,\s/);
  });

  test("event count is pluralised in the aria-label", () => {
    // "1 event" vs "3 events" — the audit specifically calls out the
    // grammatical correctness here.
    expect(src).toMatch(/dayEvents\.length === 1 \? "event" : "events"/);
  });

  test("the raw ISO key is no longer the aria-label value", () => {
    // Before: aria-label={`${cell.key}${hasEvents ? ` · ${dayEvents.length} event(s)` : ''}`}
    // After: built from MONTH_NAMES + day + year, never `cell.key`.
    expect(src).not.toMatch(/aria-label=\{`\$\{cell\.key\}/);
    // Strip line + block comments before scanning so the `event(s)`
    // string in the explainer comment doesn't trip the pin.
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    // No 'event(s)' literal in the rendered JSX.
    expect(noComments).not.toContain("event(s)");
  });
});

describe("UX-1106 — Heatmap footer copy addresses mobile (no hover)", () => {
  const src = read("src/components/planner/PlannerHeatmapCell.tsx");

  test("footer copy reads 'Hover or tap', not just 'Hover'", () => {
    // Touch devices have no hover; the heatmap cell `title` attribute
    // doubles as the tap-fallback. The copy must tell the painter.
    expect(src).toContain("Hover or tap");
    expect(src).not.toMatch(/Hover a cell for the count\./);
  });
});

describe("UX-1107 — Heatmap tooltip vocabulary aligns with dashboard", () => {
  const helpers = read("src/components/planner/plannerHeatmapHelpers.ts");

  test("tooltip uses 'activity' / 'activities', not 'action' / 'actions'", () => {
    // The rest of the dashboard speaks in "activity" — ACTIVITY widget,
    // activity_log schema, getActivityByDay. The heatmap tooltip now
    // matches.
    expect(helpers).toContain('"activity"');
    expect(helpers).toContain('"activities"');
    expect(helpers).not.toMatch(/cell\.count === 1 \? "action"/);
  });
});

describe("UX-1108 — Inspo drag-handle tap target", () => {
  const src = read("src/components/planner/ManageInspoModal.tsx");

  test("drag handle is wrapped in the tap-target class", () => {
    // .tap-target sets min-width / min-height to 44px on mobile,
    // 32px on md+ (see globals.css). The visual ⋮⋮ stays the same
    // size — only the hit area grows.
    expect(src).toMatch(
      /className="tap-target [^"]*"[\s\S]{0,200}>\s*⋮⋮/,
    );
  });
});
