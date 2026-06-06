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
const detail = read("app/projects/[id]/page.tsx");

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

describe("UX-005 — breadcrumb is consistent with the active nav item", () => {
  test("breadcrumb root reads DASHBOARD (not the stale 'Projects')", () => {
    expect(detail).toMatch(/← DASHBOARD/);
    expect(detail).not.toMatch(/← Projects/);
  });
  test("breadcrumb nav carries an aria-label", () => {
    expect(detail).toMatch(/aria-label="Breadcrumb"/);
  });
  test("breadcrumb still links the root back to /projects", () => {
    expect(detail).toMatch(/href="\/projects"/);
  });
});
