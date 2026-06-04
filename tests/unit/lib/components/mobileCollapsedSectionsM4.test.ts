/**
 * M4 — mobile `/projects` progressive-disclosure sections.
 *
 * Static source-scan net (mirrors plannerSectionScaffold / densityFoundations)
 * for the M4 acceptance under the locked Decisions (2026-06-03 §1):
 *
 *   - `/projects` is ONE page; FOCUS + PLANNER are collapsed-by-default
 *     disclosure sections on mobile (no `app/focus`, no mobile
 *     `app/planner`).
 *   - A collapsed section does NOT mount its body — the children are gated
 *     behind `open`, so the heavy FocusPanel / PlannerSection subtrees are
 *     absent from the phone DOM until expanded (first-viewport node-count
 *     floor).
 *   - Desktop stays coherent: the section is always expanded on md+ and
 *     the collapse chevron is hidden.
 *   - PLANNER mounts the shared cluster `bare` so the disclosure header
 *     owns the single "PLANNER" title (no double Card header).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("M4 — CollapsibleSection disclosure primitive", () => {
  const src = read("src/components/projects/CollapsibleSection.tsx");

  test("is a client component", () => {
    expect(src).toMatch(/^"use client";/);
  });

  test("gates the body so a collapsed section does NOT mount children", () => {
    // Body mounts only when open (or non-collapsible desktop) — collapsed
    // mobile leaves the heavy subtree out of the DOM entirely.
    expect(src).toMatch(/const bodyMounted = open \|\| !collapsible/);
    expect(src).toMatch(/bodyMounted \?\s*\(/);
  });

  test("SSR-safe: desktop-first default, collapses on phones via matchMedia", () => {
    expect(src).toMatch(/useState\(true\)/); // open defaults true (desktop-first)
    expect(src).toMatch(/matchMedia\("\(max-width: 767px\)"\)/);
    expect(src).toMatch(/setOpen\(!mq\.matches\)/);
  });

  test("exposes a real disclosure button with aria-expanded on mobile", () => {
    expect(src).toMatch(/aria-expanded=\{collapsible \? open : undefined\}/);
    expect(src).toMatch(/aria-controls=\{collapsible \? panelId : undefined\}/);
  });

  test("collapse chevron is mobile-only (md:hidden) — desktop stays open", () => {
    expect(src).toMatch(/ChevronRight/);
    expect(src).toMatch(/md:hidden/);
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

describe("M4 — /projects wires FOCUS + PLANNER as collapsed sections", () => {
  const page = read("src/app/projects/page.tsx");

  test("FOCUS + PLANNER are wrapped in CollapsibleSection", () => {
    expect(page).toContain("CollapsibleSection");
    expect(page).toMatch(/<CollapsibleSection[^>]*title="FOCUS"/s);
    expect(page).toMatch(/<CollapsibleSection title="PLANNER"/);
  });

  test("PLANNER mounts the shared cluster `bare` (disclosure owns the header)", () => {
    expect(page).toMatch(/<PlannerSection calYear=\{calYear\} calMonth=\{calMonth\} bare \/>/);
  });

  test("Decisions §1 — no mobile app/focus or app/planner route is referenced", () => {
    // The mobile path reaches FOCUS/PLANNER via the collapsed sections,
    // never via a dedicated mobile route push.
    expect(page).not.toMatch(/href="\/focus"/);
    expect(page).not.toMatch(/router\.push\("\/planner"\)/);
  });

  test("no dedicated app/focus route exists (Decisions §1)", () => {
    const focusRoute = path.resolve(ROOT, "src/app/focus/page.tsx");
    expect(fs.existsSync(focusRoute)).toBe(false);
  });

  test("order preserved: FOCUS section, then table, then PLANNER", () => {
    const focusIdx = page.indexOf('title="FOCUS"');
    const tableIdx = page.indexOf("<ProjectsDashboardTable");
    const plannerIdx = page.indexOf('title="PLANNER"');
    expect(focusIdx).toBeGreaterThan(-1);
    expect(tableIdx).toBeGreaterThan(-1);
    expect(plannerIdx).toBeGreaterThan(-1);
    expect(focusIdx).toBeLessThan(tableIdx);
    expect(tableIdx).toBeLessThan(plannerIdx);
  });
});

describe("M4 — PlannerSection bare mount", () => {
  const section = read("src/components/planner/PlannerSection.tsx");

  test("accepts a `bare` prop that skips the wrapping Card", () => {
    expect(section).toMatch(/bare\?:\s*boolean/);
    expect(section).toMatch(/if \(bare\) return grid/);
  });

  test("standalone (non-bare) mount still draws the PLANNER Card", () => {
    expect(section).toMatch(/title="PLANNER"/);
  });
});
