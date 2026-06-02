/**
 * Ross 2026-06-02 screenshot fixes on the mobile /projects view:
 *   1. FOCUS recipe was buried under the stopwatch → FocusPanel must
 *      render BEFORE the Stopwatch in the FOCUS section.
 *   2. Import / New buttons must be symmetric with the quick-add box →
 *      full-width row + flex-1 buttons on mobile.
 *   3. The FOCUS picker option text ran past its box → the select must
 *      be width-contained + truncating on mobile.
 *
 * Source-level sentinels (the established pattern here — these are
 * server/client wiring concerns that the node test env can't render).
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../../../../");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf-8");

describe("/projects mobile screenshot fixes (2026-06-02)", () => {
  const page = read("src/app/projects/page.tsx");
  const picker = read("src/components/focus/FocusPicker.tsx");

  test("FOCUS recipe (FocusPanel) renders before the Stopwatch", () => {
    const panelIdx = page.indexOf("<FocusPanel");
    const stopwatchIdx = page.indexOf("<Stopwatch");
    expect(panelIdx).toBeGreaterThan(-1);
    expect(stopwatchIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeLessThan(stopwatchIdx);
  });

  test("Import / New button row fills width + flexes on mobile", () => {
    const importIdx = page.indexOf('href="/projects/import"');
    const newIdx = page.indexOf('href="/projects/new"');
    // Both header CTAs carry the mobile fill class.
    for (const idx of [importIdx, newIdx]) {
      expect(idx).toBeGreaterThan(-1);
      const slice = page.slice(idx, idx + 200);
      expect(slice).toContain("flex-1");
    }
  });

  test("FOCUS picker select is width-contained + truncating on mobile", () => {
    expect(picker).toContain("w-full");
    expect(picker).toContain("truncate");
    expect(picker).toContain("min-w-0");
  });
});
