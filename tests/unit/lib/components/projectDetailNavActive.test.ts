/**
 * UX-005 — navigation active state + breadcrumb on /projects/[id].
 *
 * The nav rail + mobile tab bar both treat /projects as the DASHBOARD
 * section and must light it as active on a project-detail page
 * (/projects/[id]) — the section IS correct, the audit's gap was that the
 * only on-page location cues DISAGREED: the nav said "Dashboard" while the
 * breadcrumb root said "Projects". This pins:
 *   - both nav components mark the /projects item active when the path
 *     starts with /projects (covers /projects/<id>),
 *   - the project-detail breadcrumb root reads DASHBOARD to match the nav,
 *     and carries an aria-label so it's announced as a breadcrumb.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../../../src");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const navRail = read("components/NavRail.tsx");
const bottomBar = read("components/BottomTabBar.tsx");
// FIGMA-REBUILD §9 — project detail is the slide-out ProjectInspector,
// mounted on the dashboard (the /projects/[id] page is now a redirect).
const inspector = read("components/projects/ProjectInspector.tsx");

describe("UX-005 — nav marks DASHBOARD active on a project-detail path", () => {
  test("NavRail isActive matches /projects + nested /projects/<id>", () => {
    expect(navRail).toMatch(
      /href === "\/projects"[\s\S]*?pathname\.startsWith\("\/projects"\)/,
    );
  });
  test("BottomTabBar isActive matches /projects + nested /projects/<id>", () => {
    expect(bottomBar).toMatch(
      /href === "\/projects"[\s\S]*?pathname\.startsWith\("\/projects"\)/,
    );
  });
  test("both label the /projects item 'Dashboard' (single section name)", () => {
    expect(navRail).toMatch(/href:\s*"\/projects"[\s\S]*?label:\s*"Dashboard"/);
    expect(bottomBar).toMatch(
      /href:\s*"\/projects"[\s\S]*?label:\s*"Dashboard"/,
    );
  });
});

describe("UX-005 — inspector breadcrumb is consistent with the active nav item", () => {
  // FIGMA-REBUILD §9 — the inspector opens ON the dashboard (/projects), so
  // the active nav item stays DASHBOARD and the panel's own breadcrumb reads
  // the `SYS > PROJECT` idiom instead of a "← DASHBOARD" back-link. There is
  // no stale "Projects" location cue to disagree with the nav.
  test("inspector breadcrumb reads the SYS > PROJECT idiom (no stale 'Projects')", () => {
    expect(inspector).toMatch(/breadcrumb="SYS &gt; PROJECT"/);
    expect(inspector).not.toMatch(/← Projects/);
  });
  test("the slide-out panel is a labelled dialog (SlideOutPanel sets the breadcrumb)", () => {
    expect(inspector).toContain("<SlideOutPanel");
    expect(inspector).toContain("breadcrumb=");
  });
  test("closing the inspector returns to the dashboard (/projects) path", () => {
    // The close handler drops the `?project` param, landing back on the
    // bare dashboard route — the DASHBOARD nav item the rail lights.
    expect(inspector).toContain('next.delete("project")');
  });
});
