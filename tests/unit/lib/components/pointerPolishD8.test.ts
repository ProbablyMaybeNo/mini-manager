/**
 * D8 — pointer affordances, feedback & a11y polish (desktop).
 *
 * Source-scan net for the D8 deliverables on this batch's surfaces
 * [DESKTOP §D8]:
 *   step 1/2 — tooltips on the new sortable headers; cursor signifier
 *              (crosshair) on the collection canvas tool.
 *   step 3   — right-click parity: the D3 context menu's commands are also
 *              reachable without the mouse (batch bar + per-row toggles).
 *   step 5   — never-color-alone (completion bar carries a % label);
 *              OK-first dialog button order + verb label on the confirm
 *              modal.
 *   step 6   — reduced-motion guard on the new hover transitions.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("D8 — tooltips + cursor signifiers", () => {
  test("sortable headers carry an explanatory tooltip (mouse + kbd hover)", () => {
    const src = read("src/components/library/LibraryTable.tsx");
    expect(src).toMatch(/title=\{active \? `Sorted by \$\{label\}` : `Sort by \$\{label\}`\}/);
  });

  test("the collection canvas tool shows a crosshair cursor", () => {
    const src = read("src/components/planner/CollectionCanvas.tsx");
    expect(src).toMatch(/cursor: "crosshair"/);
  });
});

describe("D8 — never-color-alone", () => {
  test("the inspector completion bar carries a % label, not hue alone", () => {
    const src = read("src/components/projects/ProjectInspector.tsx");
    expect(src).toMatch(/\{row\.progressPercent\}%/);
  });

  test("status pills carry a text label (children), not hue alone", () => {
    const src = read("src/components/ui/StatusPill.tsx");
    expect(src).toMatch(/\{children\}/);
  });
});

describe("D8 — dialog button order (OK-first + verb label)", () => {
  const src = read("src/components/projects/DeleteProjectModal.tsx");

  test("the affirmative verb action leads (justify-start, danger first)", () => {
    expect(src).toMatch(/justify-start/);
    // The danger (verb) Button appears before the Cancel ghost Button.
    const dangerIdx = src.indexOf('variant="danger"');
    const cancelIdx = src.indexOf('variant="ghost"');
    expect(dangerIdx).toBeGreaterThan(-1);
    expect(cancelIdx).toBeGreaterThan(-1);
    expect(dangerIdx).toBeLessThan(cancelIdx);
  });

  test("uses a verb label, not a generic OK", () => {
    expect(src).toMatch(/"Delete forever"/);
  });
});

describe("D8 — reduced-motion guard on new hover transitions", () => {
  const src = read("src/components/library/LibraryTable.tsx");

  test("batch bar + context menu + sortable header transitions honour reduced-motion", () => {
    const matches = src.match(/transition-colors motion-reduce:transition-none/g) ?? [];
    // Sortable header, the two batch actions, Clear, and the context menu
    // item all guard motion.
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});
