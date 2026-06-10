/**
 * FOCUS-DASH (2026-06-04) — supersedes the M4 mobile collapsed-sections
 * contract.
 *
 * M4 wrapped FOCUS + PLANNER in collapsed-by-default disclosure sections
 * on the mobile /projects pane (inside the D2 `ProjectsWorkspace`). The IA
 * restructure dissolved that: the FOCUS bench moved to its own /planner
 * screen and the planner widgets moved to the DASHBOARD table surface, so
 * there is no mobile master-detail workspace and no collapsed FOCUS/PLANNER
 * disclosure on /projects anymore.
 *
 * What still holds — and is pinned here:
 *   - The `CollapsibleSection` disclosure primitive remains a correct,
 *     SSR-safe, accessible component (it's a general-purpose primitive,
 *     kept for reuse).
 *   - The dissolved master-detail workspace is gone (no ProjectsWorkspace
 *     / ProjectInspector files), and the DASHBOARD page does not reference
 *     them.
 *   - Decisions §1 still holds: no dedicated `app/focus` route — the FOCUS
 *     screen reuses the `/planner` path.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("CollapsibleSection disclosure primitive (still valid)", () => {
  const src = read("src/components/projects/CollapsibleSection.tsx");

  test("is a client component", () => {
    expect(src).toMatch(/^"use client";/);
  });

  test("gates the body so a collapsed section does NOT mount children", () => {
    expect(src).toMatch(/const bodyMounted = open \|\| !collapsible/);
    expect(src).toMatch(/bodyMounted \?\s*\(/);
  });

  test("SSR-safe: desktop-first default, collapses on phones via matchMedia", () => {
    expect(src).toMatch(/useState\(true\)/);
    expect(src).toMatch(/matchMedia\("\(max-width: 767px\)"\)/);
    expect(src).toMatch(/setOpen\(!mq\.matches\)/);
  });

  test("exposes a real disclosure button with aria-expanded on mobile", () => {
    expect(src).toMatch(/aria-expanded=\{collapsible \? open : undefined\}/);
    expect(src).toMatch(/aria-controls=\{collapsible \? panelId : undefined\}/);
  });

  test("toggle meets the tap-target floor; no cyan; no raw hex", () => {
    expect(src).toContain("tap-target");
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    expect(noComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(noComments).not.toMatch(/var\(--color-cyan\)/);
  });
});

describe("FIGMA-REBUILD §9/§7 — master-detail dissolved, inspector + /focus added", () => {
  // FIGMA-REBUILD supersedes the FOCUS-DASH IA:
  //   - the D2 two-pane master-detail ProjectsWorkspace is still gone, but
  //   - project detail is now a slide-out ProjectInspector (REBUILD_SPEC §9)
  //     mounted on the dashboard, and
  //   - FOCUS is a dedicated full /focus page (REBUILD_SPEC §0/§7), no longer
  //     reusing /planner (the /planner route was retired).
  test("the old two-pane ProjectsWorkspace is gone", () => {
    expect(
      fs.existsSync(
        path.resolve(ROOT, "src/components/projects/ProjectsWorkspace.tsx"),
      ),
    ).toBe(false);
  });

  test("project detail is the slide-out ProjectInspector mounted on the dashboard", () => {
    expect(
      fs.existsSync(
        path.resolve(ROOT, "src/components/projects/ProjectInspector.tsx"),
      ),
    ).toBe(true);
    const page = read("src/app/projects/page.tsx");
    expect(page).not.toContain("ProjectsWorkspace");
    expect(page).toContain("<ProjectInspector");
  });

  test("Decisions §1 superseded — FOCUS is a dedicated /focus route", () => {
    const focusRoute = path.resolve(ROOT, "src/app/focus/page.tsx");
    expect(fs.existsSync(focusRoute)).toBe(true);
  });
});
