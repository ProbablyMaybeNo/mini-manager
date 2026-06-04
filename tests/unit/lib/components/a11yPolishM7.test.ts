/**
 * M7 — accessibility & polish (mobile).
 *
 * Source-scan net for the M7 deliverables on the surfaces this batch
 * built/changed [MOBILE §M7]:
 *   step 3 — overlays have a visible Close (×) + Back-dismiss, not
 *            gesture-only (the command palette).
 *   step 4 — the de-buttoned collection grid exposes ONE labelled SR
 *            summary (role="img" + aria-label), not thousands of nodes.
 *   step 5 — reduced-motion respected on the new animated controls.
 *   step 6 — focus-visible (≥2px, 3:1) on the new controls (NavRail search
 *            trigger, inspector tabs, disclosure toggle).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}

describe("M7 step 3 — command palette overlay dismissal", () => {
  const src = read("src/components/search/GlobalSearch.tsx");

  test("has a visible Close (×) button, not just an 'esc' hint", () => {
    expect(src).toMatch(/aria-label="Close command palette"/);
  });

  test("Back (popstate) dismisses the open palette", () => {
    expect(src).toMatch(/addEventListener\("popstate", onPop\)/);
    expect(src).toMatch(/const onPop = \(\) => setOpen\(false\)/);
  });

  test("click-outside + Escape dismissal preserved (never gesture-only)", () => {
    expect(src).toMatch(/if \(e\.target === e\.currentTarget\) setOpen\(false\)/);
    expect(src).toMatch(/e\.key === "Escape" && open/);
  });
});

describe("M7 step 4 — de-buttoned collection grid SR summary", () => {
  const src = read("src/components/library/CollectionCanvas.tsx");

  test("the canvas is one role=img element with a labelled summary", () => {
    expect(src).toMatch(/role="img"/);
    expect(src).toMatch(/aria-label=\{summaryLabel\}/);
  });
});

describe("M7 step 6 — focus-visible on the new controls", () => {
  test("NavRail command-palette trigger has a visible focus ring", () => {
    const nav = read("src/components/NavRail.tsx");
    const idx = nav.indexOf('aria-label="Open command palette"');
    expect(idx).toBeGreaterThan(-1);
    // The focus class sits in the same button's className (a few lines
    // after the aria-label in the JSX) — widen the forward window.
    const win = nav.slice(Math.max(0, idx - 400), idx + 600);
    expect(win).toMatch(/focus-visible:outline-2/);
  });

  test("inspector tabs have a visible focus ring", () => {
    const inspector = read("src/components/projects/ProjectInspector.tsx");
    expect(inspector).toMatch(/focus-visible:outline-2 focus-visible:outline-\[var\(--color-accent\)\]/);
  });

  test("disclosure toggle has a visible focus ring", () => {
    const section = read("src/components/projects/CollapsibleSection.tsx");
    expect(section).toMatch(/focus-visible:outline-2/);
  });
});

describe("M7 step 5 — reduced motion on new animated controls", () => {
  test("disclosure chevron honours prefers-reduced-motion", () => {
    const section = read("src/components/projects/CollapsibleSection.tsx");
    expect(section).toMatch(/motion-reduce:transition-none/);
  });
});
