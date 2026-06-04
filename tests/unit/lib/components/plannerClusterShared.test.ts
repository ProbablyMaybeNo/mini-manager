/**
 * Group 2 step 2 — Planner widget cluster is shared-ready.
 *
 * The cluster (`PlannerSection`) composes the five planner cells
 * (COLLECTION canvas + calendar + streak + activity + inspo) and must
 * render in BOTH containers without a fork:
 *   - mobile: inside the collapsed `▸ PLANNER` disclosure on /projects
 *     (built in M4),
 *   - desktop: as the body of the new /planner route (built in D6).
 *
 * Shared-readiness contract pinned here:
 *   1. `PlannerSection` is a self-contained component that self-fetches
 *      via its child cells (no props required beyond the calendar
 *      search-params), so either container can mount `<PlannerSection />`.
 *   2. It threads `calYear` / `calMonth` straight to the calendar cell —
 *      the only state either container has to supply — so the
 *      `?calYear` / `?calMonth` URL contract works on /projects AND
 *      /planner identically.
 *   3. It is breakpoint-responsive on its own (single stack < md, the
 *      5-col dashboard grid on md+), so neither container has to inject
 *      layout — the same element renders correctly in a narrow mobile
 *      disclosure and a wide desktop route.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("Planner cluster is shared-ready (Group 2 step 2)", () => {
  const section = read("src/components/planner/PlannerSection.tsx");

  test("self-fetching: child cells own their data, no required data props", () => {
    // The only props are the optional calendar search-params — the
    // signature destructures with a `= {}` default so a bare
    // `<PlannerSection />` mount is valid in either container.
    expect(section).toMatch(
      /export async function PlannerSection\(\s*\{[^}]*\}\s*:\s*Props\s*=\s*\{\}\s*\)/,
    );
    // The cells self-fetch (no data passed down from the section).
    expect(section).not.toMatch(/<HeatSinkGridCell\s+[^/>]*=/);
  });

  test("threads calYear / calMonth to the calendar cell only", () => {
    expect(section).toMatch(
      /<PlannerCalendarCell\s+calYear=\{calYear\}\s+calMonth=\{calMonth\}/,
    );
  });

  test("is breakpoint-responsive on its own (mobile stack + desktop grid)", () => {
    // No container should have to inject layout — the cluster ships the
    // responsive grid itself so it drops into a narrow mobile disclosure
    // and a wide desktop route unchanged.
    expect(section).toContain("grid-cols-1");
    expect(section).toContain("md:grid-cols-5");
  });
});
