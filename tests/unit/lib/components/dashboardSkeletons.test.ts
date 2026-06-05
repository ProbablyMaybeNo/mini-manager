/**
 * DASH-SKELETON (2026-06-05) — in-theme loading skeletons (item 4).
 *
 * The async dashboard widget cells must render an in-theme skeleton that
 * mirrors the card layout on first paint, not a spinner or a flash of
 * empty cards (UXUI_DASHBOARD_DESIGN.md §10). Source-sentinel coverage
 * (matches the neighbour plannerSectionScaffold style) pins:
 *   - both async cells wrapped in <Suspense> with skeleton fallbacks,
 *   - skeletons reuse the Card primitive (same header/accent/height),
 *   - the shimmer is reduced-motion-guarded + token-coloured (no grey
 *     library shimmer), per the CRT aesthetic (§13).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../../", rel), "utf-8");
}

describe("DashboardWidgets — Suspense skeletons", () => {
  const widgets = read("src/components/dashboard/DashboardWidgets.tsx");

  test("wraps each async cell in <Suspense> with a skeleton fallback", () => {
    expect(widgets).toContain("Suspense");
    expect(widgets).toMatch(
      /<Suspense fallback=\{<ActivitySkeleton \/>\}>[\s\S]*?<PlannerActivityCell/,
    );
    expect(widgets).toMatch(
      /<Suspense fallback=\{<CalendarSkeleton \/>\}>[\s\S]*?<PlannerCalendarCell/,
    );
  });
});

describe("DashboardSkeletons component", () => {
  const src = read("src/components/dashboard/DashboardSkeletons.tsx");

  test("reuses the Card primitive so the layout doesn't shift on load", () => {
    expect(src).toContain("Card");
    expect(src).toContain('className="h-full"');
  });

  test("mirrors both widget cells (Activity list + Calendar grid)", () => {
    expect(src).toContain("ACTIVITY");
    expect(src).toContain("CALENDAR");
    // Calendar skeleton mirrors the 7-col month grid.
    expect(src).toContain("grid-cols-7");
  });

  test("shimmer is reduced-motion guarded (motion-safe), not always-on", () => {
    expect(src).toContain("motion-safe:animate-pulse");
  });

  test("bars are token-coloured, not a grey library shimmer", () => {
    expect(src).toContain("bg-[var(--color-bg-elevated)]");
    // No raw hex / tailwind grey palette in the skeleton.
    expect(src).not.toMatch(/bg-(?:gray|slate|zinc|neutral)-\d/);
  });

  test("exposes an accessible loading status for screen readers", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain("sr-only");
  });
});
